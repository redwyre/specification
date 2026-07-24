import { serializeRecord } from "./openapi3";

/**
 * Maps ID value prefixes to their corresponding schema file names.
 * When a string property starts with one of these prefixes, a $ref is emitted
 * instead of a plain string type.
 */
const ID_PREFIX_MAP: Record<string, string> = {
	avtr_: "AvatarID",
	bdg_: "BadgeID",
	fld_: "FileID",
	file_: "FileID",
	grp_: "GroupID",
	inst_: "InstanceID",
	jam_: "JamID",
	usr_: "UserID",
	wrld_: "WorldID",
};

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\//;

/**
 * Try to match a string value to a known ID schema via its prefix.
 * Returns a relative $ref path or null.
 */
function inferIdRef(value: string): string | null {
	for (const [prefix, schema] of Object.entries(ID_PREFIX_MAP)) {
		if (value.startsWith(prefix)) {
			return `./${schema}.yaml`;
		};
	}
	return null;
}

/**
 * For null / undefined values, guess a more specific base type from the field
 * name so we can emit `nullable: true` together with the right type hint.
 */
function typeHintForNullField(fieldName?: string): Record<string, unknown> {
	if (!fieldName) return { type: "string" };
	const lower = fieldName.toLowerCase();

	// Field names ending with common date/time suffixes
	if (lower.endsWith("date")) {
		return { type: "string", format: "date" };
	}

	if (lower.endsWith("datetime") || lower.endsWith("time")) {
		return { type: "string", format: "date-time" };
	}

	return { type: "string" };
}

/**
 * When an array is empty we have no samples to infer items from.
 * Use the field name as a heuristic.
 */
function inferEmptyArrayItems(fieldName?: string): Record<string, unknown> {
	if (!fieldName) return { type: "string" };
	const lower = fieldName.toLowerCase();

	// Friend lists are arrays of user IDs
	if (
		lower === "friends"
		|| lower === "onlinefriends"
		|| lower === "offlinefriends"
		|| lower === "activefriends"
	) {
		return { $ref: "./UserID.yaml" };
	}

	if (lower.includes("tag")) {
		return { $ref: "./Tag.yaml" };
	}

	return { type: "string" };
}

/**
 * Recursively infer an OpenAPI property schema from a raw JSON value.
 *
 * @param value     The JSON value to inspect
 * @param fieldName The property name (used for context-aware heuristics)
 */
function inferPropertySchema(
	value: unknown,
	fieldName?: string,
): Record<string, unknown> {
	// null / undefined
	if (value === null || value === undefined) {
		return { ...typeHintForNullField(fieldName), nullable: true };
	}

	// boolean
	if (typeof value === "boolean") {
		return { type: "boolean" };
	}

	// number
	if (typeof value === "number") {
		if (Number.isInteger(value)) {
			const prop: Record<string, unknown> = { type: "integer", example: value };
			if (value >= 0) prop.minimum = 0;
			return prop;
		}
		return { type: "number", example: value };
	}

	// string
	if (typeof value === "string") {
		const idRef = inferIdRef(value);
		if (idRef) return { $ref: idRef };

		if (URL_RE.test(value)) {
			return { type: "string", format: "uri", example: value };
		}
		if (DATE_TIME_RE.test(value)) {
			return { type: "string", format: "date-time", example: value };
		}
		if (DATE_RE.test(value)) {
			return { type: "string", format: "date", example: value };
		}

		const prop: Record<string, unknown> = { type: "string" };
		if (value !== "") prop.example = value;
		return prop;
	}

	// array
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return { type: "array", items: inferEmptyArrayItems(fieldName) };
		}
		// Use the first element to determine item type
		return { type: "array", items: inferPropertySchema(value[0]) };
	}

	// object
	if (typeof value === "object") {
		const properties: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			properties[key] = inferPropertySchema(val, key);
		}
		return { type: "object", properties };
	}

	return { type: "string" };
}

/**
 * Convert raw JSON data into an OpenAPI-style YAML schema.
 *
 * @param data  Parsed JSON object
 * @param title Schema title (typically the file name without extension)
 */
export function convertJsonDataToOpenApiSchema(
	data: Record<string, unknown>,
	title: string,
): string {
	const properties: Record<string, unknown> = {};
	const required: Array<string> = [];

	for (const [key, value] of Object.entries(data)) {
		properties[key] = inferPropertySchema(value, key);
		if (value !== null && value !== undefined) {
			required.push(key);
		}
	}

	const schema: Record<string, unknown> = {
		title,
		type: "object",
		properties,
	};

	if (required.length > 0) {
		schema.required = required.sort();
	}

	return `${serializeRecord(schema, 0)}\n`;
}
