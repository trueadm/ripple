/**
 *
 * @param {string} message
 * @param {string} filename
 * @param {any} node
 */
export function error(message, filename, node) {
	let errorMessage = message;

	if (node && node.loc) {
		// Use GitHub-style range format: filename#L39C24-L39C32
		const startLine = node.loc.start.line;
		const startColumn = node.loc.start.column;
		const endLine = node.loc.end.line;
		const endColumn = node.loc.end.column;

		const rangeInfo = `${filename}#L${startLine}C${startColumn}-L${endLine}C${endColumn}`;
		errorMessage += ` (${rangeInfo})`;
	} else {
		errorMessage += ` (${filename})`;
	}

	throw new Error(errorMessage);
}
