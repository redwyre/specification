import { indent, yamlString } from "./yaml";

const _schema_keys = [
	"id",
	"title",
	"name",
	"deprecated",
	"$ref",
	"type",
	"description",
	"nullable",
	"additionalProperties",
	"properties",
	"required",
	"enum",
	"default",
	"example"
];

/**
 * Serialise a record (object) to YAML.
 *
 * @param record  The record to serialise
 * @param depth   Current indentation depth (0-based)
 */
export function serializeRecord(
	record: Record<string, unknown>,
	depth: number,
	sorted: boolean = true
): string {
	const pad = indent(depth);
	const keys = Object.keys(record);
	if (sorted) {
		keys.sort((a, b) => {
			const ai = _schema_keys.indexOf(a);
			const bi = _schema_keys.indexOf(b);
			const aOrder = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
			const bOrder = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
			return aOrder - bOrder || a.localeCompare(b);
		});
	}
	if (keys.length === 0) return `${pad}{}`;
	const lines = keys.map((key) => {
		const val = record[key];
		if (val === undefined) return null;

		// $ref — always a single-line scalar
		if (key === "$ref" && typeof val === "string") {
			return `${pad}${yamlString(key)}: ${val}`;
		}

		// Nested object that isn't `properties` or `items` (e.g. inline object schemas)
		if (typeof val === "object" && val !== null && !Array.isArray(val) && key !== "properties") {
			// Plain object — serialise children
			const childLines = serializeRecord(val as Record<string, unknown>, depth + 1).split("\n");
			return `${pad}${yamlString(key)}:\n${childLines.join("\n")}`;
		}

		// Array — serialise the array
		if (Array.isArray(val)) {
			const childStr = serializeValue(val, depth + 1);
			return `${pad}${yamlString(key)}:\n${childStr}`;
		}

		// Nested object used as a map (not schema-like), e.g. performance
		if (typeof val === "object" && val !== null && key === "properties") {
			const childLines = serializeRecord(val as Record<string, unknown>, depth + 1, false).split("\n");
			return `${pad}${yamlString(key)}:\n${childLines.join("\n")}`;
		}

		// Scalar
		const scalarStr = serializeValue(val, 0).trimStart();
		return `${pad}${yamlString(key)}: ${scalarStr}`;
	});

	return lines.filter(Boolean).join("\n");
}

/**
 * Serialise a single value (scalar, array, or null/undefined) to YAML.
 *
 * @param value  The JS value to serialise
 * @param depth  Current indentation depth (0-based)
 */
export function serializeValue(
	value: unknown,
	depth: number
): string {
	const pad = indent(depth);

	// null / undefined
	if (value === null || value === undefined) {
		return `${pad}null`;
	}

	// boolean
	if (typeof value === "boolean") {
		return `${pad}${value}`;
	}

	// number
	if (typeof value === "number") {
		return `${pad}${value}`;
	}

	// string
	if (typeof value === "string") {
		// Block scalar for multi-line strings
		if (value.includes("\n")) {
			const lines = value.split("\n");
			const lastIdx = lines.length - 1;
			const body = lines
				.map((line, i) => {
					// Trim trailing empty lines
					if (i === lastIdx && line === "") return null;
					return `${pad}  ${line}`;
				})
				.filter(Boolean)
				.join("\n");
			return `${pad}|-\\n${body}`;
		}
		return `${pad}${yamlString(value)}`;
	}

	// array
	if (Array.isArray(value)) {
		if (value.length === 0) return `${pad}[]`;
		const items = value.map((item) => {
			if (typeof item === "object" && item !== null && !Array.isArray(item)) {
				// Inline the first property on the dash line
				const lines = serializeRecord(item as Record<string, unknown>, depth + 1).split("\n");
				// Replace first indented line with dash-prefixed version
				const first = lines[0];
				const stripped = first.replace(new RegExp(`^${indent(depth + 1)}`), "");
				return `${pad}- ${stripped}\n${lines.slice(1).join("\n")}`;
			}
			return `${pad}- ${serializeValue(item, 0).trimStart()}`;
		});
		return items.join("\n");
	}

	// object — delegate to serializeRecord
	if (typeof value === "object") {
		return serializeRecord(value as Record<string, unknown>, depth);
	}

	return `${pad}${value}`;
}
