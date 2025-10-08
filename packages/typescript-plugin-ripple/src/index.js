const { createLanguageServicePlugin } = require('@volar/typescript/lib/quickstart/createLanguageServicePlugin.js')
const { getRippleLanguagePlugin } = require('./language.js')

module.exports = createLanguageServicePlugin((ts, info) => {
  return {
		// Removing languagePlugins: [...] as Volar already adds it
    setup(language) {
      const languageService = info.languageService;
			info.languageService = new Proxy(languageService, {
				get(target, prop) {
					const value = target[prop];

					if (prop === 'getSyntacticDiagnostics') {
						return getSyntacticDiagnostics;
					}
					if (prop === 'getSemanticDiagnostics') {
						return getSemanticDiagnostics;
					}
					if (prop === 'getSuggestionDiagnostics') {
						return getSuggestionDiagnostics;
					}

					// FIX: Bind all methods to target so `this` remains correct
					if (typeof value === 'function') {
						return value.bind(target);
					}
					return value;
				},
				set(target, prop, value) {
					target[prop] = value;
					return true;
				},
			});

      function getSyntacticDiagnostics(fileName) {
        return isErrorMode(fileName) ? [] : languageService.getSyntacticDiagnostics(fileName);
      }

      function getSemanticDiagnostics(fileName) {
        return isErrorMode(fileName) ? [] : languageService.getSemanticDiagnostics(fileName);
      }

      function getSuggestionDiagnostics(fileName) {
        return isErrorMode(fileName) ? [] : languageService.getSuggestionDiagnostics(fileName);
      }

      function isErrorMode(fileName) {
        const sourceScript = language.scripts.get(fileName);
        return !!sourceScript.generated?.root?.isErrorMode;
      }
    },
  };
});
