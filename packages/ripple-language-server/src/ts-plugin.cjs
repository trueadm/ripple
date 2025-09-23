const { create: createTypeScriptServices } = require('volar-service-typescript');
const { URI } = require('vscode-uri');

function createTypeScriptPlugins(ts) {
	const tsServicePlugins = createTypeScriptServices(ts, {});

	return tsServicePlugins.map((plugin) => {
		if (plugin.name === 'typescript-semantic') {
			return {
				...plugin,
				create(context) {
					const type_script_plugin = plugin.create(context);

					return {
						...type_script_plugin,
						async provideDiagnostics(document, token) {
							// Check if this document is in error mode (Ripple compilation failed)
							// If so, skip TypeScript analysis to avoid confusing diagnostics
							const uri = URI.parse(document.uri);
							const decoded = context.decodeEmbeddedDocumentUri(uri);

							if (decoded) {
								const sourceScript = context.language.scripts.get(decoded[0]);
								if (sourceScript && sourceScript.generated) {
									const virtualCode = sourceScript.generated.embeddedCodes.get(decoded[1]);
									if (virtualCode && virtualCode.isErrorMode) {
										return null;
									}
								}
							}

							const diagnostics = await type_script_plugin.provideDiagnostics(document, token);

							if (diagnostics.length > 0) {
								return diagnostics;
							}
							return null;
						},
					};
				},
			};
		}

		return plugin;
	});
}

module.exports = {
	createTypeScriptPlugins,
};
