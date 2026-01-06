/**
@import * as AST from 'estree';
@import { RippleCompileError } from 'ripple/compiler';
*/

/**
 *
 * @param {string} message
 * @param {string} filename
 * @param {AST.Node} node
 * @param {RippleCompileError[]} [errors]
 * @returns {void}
 */
export function error(message, filename, node, errors) {
	const error = /** @type {RippleCompileError} */ (new Error(message));

	// same as the acorn compiler error
	error.pos = node.start ?? undefined;
	error.raisedAt = node.end ?? undefined;

	// custom properties
	error.fileName = filename;
	error.end = node.end ?? undefined;
	error.loc = !node.loc
		? undefined
		: {
				start: {
					line: node.loc.start.line,
					column: node.loc.start.column,
				},
				end: {
					line: node.loc.end.line,
					column: node.loc.end.column,
				},
			};

	if (errors) {
		error.type = 'usage';
		errors.push(error);
		return;
	}

	error.type = 'fatal';
	throw error;
}
