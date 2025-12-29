export const IDENTIFIER_OBFUSCATION_PREFIX = '_$_';
export const STYLE_IDENTIFIER = IDENTIFIER_OBFUSCATION_PREFIX + encode_utf16_char('#') + 'style';
export const SERVER_IDENTIFIER = IDENTIFIER_OBFUSCATION_PREFIX + encode_utf16_char('#') + 'server';
export const CSS_HASH_IDENTIFIER = IDENTIFIER_OBFUSCATION_PREFIX + 'hash';

const DECODE_UTF16_REGEX = /_u([0-9a-fA-F]{4})_/g;

/**
 * @param {string} char
 * @returns {string}
 */
function encode_utf16_char(char) {
	return `_u${('0000' + char.charCodeAt(0).toString(16)).slice(-4)}_`;
}

/**
 * @param {string} encoded
 * @returns {string}
 */
function decoded_utf16_string(encoded) {
	return encoded.replace(DECODE_UTF16_REGEX, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

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
		IDENTIFIER_OBFUSCATION_PREFIX +
		(second_part ? second_part + '__' + first_part : first_part + '__')
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
	name = name.replaceAll(IDENTIFIER_OBFUSCATION_PREFIX, '');
	const parts = name.split('__');
	return decoded_utf16_string((parts[1] ? parts[1] : '') + parts[0]);
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
