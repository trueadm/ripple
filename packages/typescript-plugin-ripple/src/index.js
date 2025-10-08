const { createLanguageServicePlugin } = require('@volar/typescript/lib/quickstart/createLanguageServicePlugin.js')

module.exports = createLanguageServicePlugin((ts, info) => {
  return {
		// Removing languagePlugins: [...] as Volar already adds it
    setup(language) {
      const languageService = info.languageService;
			info.languageService = new Proxy(languageService, {
				get(target, prop, receiver) {
					/** @type {Record<string |symbol, Function>} */
					const overrides = {
						getSyntacticDiagnostics,
						getSemanticDiagnostics,
						getSuggestionDiagnostics,
					};
					if (prop in overrides) {
						return overrides[prop];
					}
					return Reflect.get(target, prop, receiver);
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
