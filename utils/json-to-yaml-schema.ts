import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { argv, exit } from "node:process";

import { convertJsonDataToOpenApiSchema } from "./process-json";

/**
 * ---------------------------------------------------------------------------
 * CLI entry-point
 * ---------------------------------------------------------------------------
 */
if (import.meta.main) {
	/* eslint-disable no-console */
	const args = argv.slice(2);

	if (args.length < 1) {
		console.error("Usage: pnpm tsx utils/json-to-yaml-schema.ts <input.json> [output.yaml]");
		exit(1);
	}

	const inputPath = args[0];
	const raw = readFileSync(inputPath, "utf-8");
	const parsed = JSON.parse(raw) as Record<string, unknown>;

	const title = (parsed.title as string | undefined) ?? basename(inputPath, ".json");
	const outputPath = args[1] ?? `openapi/components/schemas/${title}.yaml`;
	const yaml = convertJsonDataToOpenApiSchema(parsed, title);
	writeFileSync(outputPath, yaml, "utf-8");
	console.log(`✓ Generated schema from data ${inputPath} → ${outputPath}`);
}
