/** Characters that require a string to be quoted in YAML. */
export function needsQuoting(s: string): boolean {
	if (s === "") return true;
	// Matches booleans, null, integers, floats
	if (/^(?:true|false|null|~|\d+(?:\.\d+)?)$/i.test(s)) return true;
	// Starts/ends with whitespace
	if (/^\s|\s$/.test(s)) return true;
	// Contains YAML-special characters
	if (/[:{}[\],&*?|>!%#@`'"\n]/.test(s)) return true;
	// Starts with a dash followed by space (looks like a list item)
	if (s.startsWith("- ")) return true;
	return false;
}

export function yamlString(s: string): string {
	if (s === "") return `""`;
	if (needsQuoting(s)) {
		// Use double quotes, escaping internal quotes and backslashes
		return `"${s.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
	}
	return s;
}

export function indent(depth: number): string {
	return "  ".repeat(depth);
}
