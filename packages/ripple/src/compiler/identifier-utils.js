export const IDENTIFIER_OBFUSCATION_PREFIX = '_$_';

/**
 * @param {string} name
 * @returns {string}
 */
export function obfuscate_identifier(name) {
	let start = 0;
	if (name[0] === name[0].toUpperCase()) {
		start = 1;
	}
	const index = find_next_uppercase(name, start);

	const first_part = name.slice(0, index);
	const second_part = name.slice(index);

	return (
		IDENTIFIER_OBFUSCATION_PREFIX + (second_part ? second_part + '__' + first_part : first_part)
	);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function is_identifier_obfuscated(name) {
	return name.startsWith(IDENTIFIER_OBFUSCATION_PREFIX);
}

/**
 * @param {string} name
 * @returns {string}
 */
export function deobfuscate_identifier(name) {
	name = name.replace(IDENTIFIER_OBFUSCATION_PREFIX, '');
	const parts = name.split('__');
	return (parts[1] ? parts[1] : '') + parts[0];
}

/**
 * Finds the next uppercase character or returns name.length
 * @param {string} name
 * @param {number} start
 * @returns {number}
 */
function find_next_uppercase(name, start) {
	for (let i = start; i < name.length; i++) {
		if (name[i] === name[i].toUpperCase()) {
			return i;
		}
	}
	return name.length;
}
