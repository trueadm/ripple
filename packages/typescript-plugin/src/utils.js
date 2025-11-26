const DEBUG = process.env.RIPPLE_DEBUG === 'true';

/**
 * Create a logging utility with a specific label
 * @param {string} label
 * @returns {{
 * 	log: (...args: unknown[]) => void,
 * 	logError: (...args: unknown[]) => void,
 * 	logWarning: (...args: unknown[]) => void,
 * }}
 */
function createLogging(label) {
	return {
		log(...args) {
			if (DEBUG) {
				console.log(label, ...args);
			}
		},
		logError(...args) {
			if (DEBUG) {
				console.error(label, ...args);
			}
		},
		logWarning(...args) {
			if (DEBUG) {
				console.warn(label, ...args);
			}
		},
	};
}

module.exports = {
	createLogging,
	DEBUG,
};
