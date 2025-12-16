/**
 * @import {LanguageServicePlugin} from '@volar/language-server'
 */

const { CompletionItemKind, InsertTextFormat } = require('@volar/language-server');
const { getVirtualCode, createLogging } = require('./utils.js');

const { log } = createLogging('[Ripple Completion Plugin]');

/**
 * Ripple-specific completion enhancements
 * Adds custom completions for Ripple syntax patterns
 */
const RIPPLE_SNIPPETS = [
	{
		label: 'component',
		kind: CompletionItemKind.Snippet,
		detail: 'Ripple Component',
		documentation: 'Create a new Ripple component',
		insertText: 'component ${1:ComponentName}(${2:props}) {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-component',
	},
	{
		label: 'track',
		kind: CompletionItemKind.Snippet,
		detail: 'Reactive state with track',
		documentation: 'Create a reactive tracked value',
		insertText: 'let ${1:name} = track(${2:initialValue});',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-track',
	},
	{
		label: 'track-derived',
		kind: CompletionItemKind.Snippet,
		detail: 'Derived reactive value',
		documentation: 'Create a derived reactive value',
		insertText: 'let ${1:name} = track(() => ${2:@dependency});',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-track-derived',
	},
	{
		label: 'track-getter-setter',
		kind: CompletionItemKind.Snippet,
		detail: 'track with get/set',
		documentation: 'Create tracked value with custom getter/setter',
		insertText:
			'let ${1:name} = track(${2:0},\n\t(current) => {\n\t\t$3\n\t\treturn current;\n\t},\n\t(next, prev) => {\n\t\t$4\n\t\treturn next;\n\t}\n);',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-track-getter-setter',
	},
	{
		label: 'trackSplit',
		kind: CompletionItemKind.Snippet,
		detail: 'Split props with trackSplit',
		documentation: 'Destructure props while preserving reactivity',
		insertText: "const [${1:children}, ${2:rest}] = trackSplit(props, [${3:'children'}]);",
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-trackSplit',
	},
	{
		label: 'effect',
		kind: CompletionItemKind.Snippet,
		detail: 'Create an effect',
		documentation: 'Run side effects when reactive dependencies change',
		insertText: 'effect(() => {\n\t${1:console.log(@value);}\n});',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-effect',
	},
	{
		label: 'for-of',
		kind: CompletionItemKind.Snippet,
		detail: 'for...of loop',
		documentation: 'Iterate over items in Ripple template',
		insertText: 'for (const ${1:item} of ${2:items}) {\n\t<${3:li}>{${1:item}}</${3:li}>\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-for-of',
	},
	{
		label: 'for-index',
		kind: CompletionItemKind.Snippet,
		detail: 'for...of loop with index',
		documentation: 'Iterate with index',
		insertText:
			'for (const ${1:item} of ${2:items}; index ${3:i}) {\n\t<${4:li}>{${1:item}}{" at "}{${3:i}}</${4:li}>\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-for-index',
	},
	{
		label: 'for-key',
		kind: CompletionItemKind.Snippet,
		detail: 'for...of loop with key',
		documentation: 'Iterate with key for identity',
		insertText:
			'for (const ${1:item} of ${2:items}; key ${1:item}.${3:id}) {\n\t<${4:li}>{${1:item}.${5:text}}</${4:li}>\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-for-key',
	},
	{
		label: 'for-index-key',
		kind: CompletionItemKind.Snippet,
		detail: 'for...of loop with key',
		documentation: 'Iterate with key for identity',
		insertText:
			"for (const ${1:item} of ${2:items}; index ${3:i}; key ${1:item}.${4:id}) {\n\t<${5:li}>{${1:item}.${6:text}}{' at index '}{${3}}</${5:li}>\n}",
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-for-key-index',
	},
	{
		label: 'if-else',
		kind: CompletionItemKind.Snippet,
		detail: 'if...else statement',
		documentation: 'Conditional rendering',
		insertText: 'if (${1:condition}) {\n\t$2\n} else {\n\t$3\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-if-else',
	},
	{
		label: 'switch-case',
		kind: CompletionItemKind.Snippet,
		detail: 'switch statement',
		documentation: 'Switch-based conditional rendering',
		insertText:
			"switch (${1:value}) {\n\tcase ${2:'case1'}:\n\t\t$3\n\t\tbreak;\n\tcase ${4:'case2'}:\n\t\t$5\n\t\tbreak;\n\tdefault:\n\t\t$6\n}",
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-switch-case',
	},
	{
		label: 'untrack',
		kind: CompletionItemKind.Snippet,
		detail: 'Untrack reactive value',
		documentation: 'Read reactive value without creating dependency',
		insertText: 'untrack(() => @${1:value})',
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-untrack',
	},
	{
		label: 'try-pending',
		kind: CompletionItemKind.Snippet,
		detail: 'try...pending block',
		documentation: 'Handle async content with loading fallback',
		insertText: "try {\n\t$1\n} pending {\n\t<div>{'Loading...'}</div>\n}",
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-try-pending',
	},
];

/**
 * Import suggestions for Ripple
 */
const RIPPLE_IMPORTS = [
	{
		label: 'import track',
		kind: CompletionItemKind.Snippet,
		detail: 'Import track from ripple',
		insertText: "import { track } from 'ripple';",
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-import-track',
	},
	{
		label: 'import effect',
		kind: CompletionItemKind.Snippet,
		detail: 'Import effect from ripple',
		insertText: "import { effect } from 'ripple';",
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-import-effect',
	},
	{
		label: 'import trackSplit',
		kind: CompletionItemKind.Snippet,
		detail: 'Import trackSplit from ripple',
		insertText: "import { trackSplit } from 'ripple';",
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-import-trackSplit',
	},
	{
		label: 'import untrack',
		kind: CompletionItemKind.Snippet,
		detail: 'Import untrack from ripple',
		insertText: "import { untrack } from 'ripple';",
		insertTextFormat: InsertTextFormat.Snippet,
		sortText: '0-import-untrack',
	},
	// {
	// 	label: 'import ripple-types',
	// 	kind: CompletionItemKind.Snippet,
	// 	detail: 'Import Ripple types',
	// 	insertText: "import type { Tracked, PropsWithChildren, Component } from 'ripple';",
	// 	insertTextFormat: InsertTextFormat.Snippet,
	// 	sortText: '0-import-types',
	// },
];

/**
 * @returns {LanguageServicePlugin}
 */
function createCompletionPlugin() {
	return {
		name: 'ripple-completion-enhancer',
		capabilities: {
			completionProvider: {
				// Trigger on Ripple-specific syntax:
				// '<' - JSX/HTML tags
				// Avoid '.' and ' ' to reduce noise - let manual trigger (Ctrl+Space) handle those
				triggerCharacters: ['<'],
				resolveProvider: false,
			},
		},
		// leaving context for future use
		create(context) {
			return {
				// Mark this as providing additional completions, not replacing existing ones
				// This ensures TypeScript/JavaScript completions are still shown alongside Ripple snippets
				isAdditionalCompletion: true,
				async provideCompletionItems(document, position, completionContext, _token) {
					if (!document.uri.endsWith('.ripple')) {
						return { items: [], isIncomplete: false };
					}

					const [virtualCode] = getVirtualCode(document, context);

					// Check if we're inside an embedded code (like CSS in <style> blocks)
					// If so, don't provide Ripple snippets - let CSS completions take priority
					if (virtualCode && virtualCode.languageId === 'css') {
						log('Skipping Ripple completions in CSS context');
						return { items: [], isIncomplete: false };
					}

					const line = document.getText({
						start: { line: position.line, character: 0 },
						end: position,
					});

					const items = [];

					// Debug: log trigger info with clear marker
					// triggerKind: 1 = Invoked (Ctrl+Space), 2 = TriggerCharacter, 3 = TriggerForIncompleteCompletions
					log('🔔 Completion triggered:', {
						triggerKind: completionContext.triggerKind,
						triggerKindName:
							completionContext.triggerKind === 1
								? 'Invoked'
								: completionContext.triggerKind === 2
									? 'TriggerCharacter'
									: completionContext.triggerKind === 3
										? 'Incomplete'
										: 'Unknown',
						triggerCharacter: completionContext.triggerCharacter || '(none)',
						position: `${position.line}:${position.character}`,
						lineEnd: line.substring(Math.max(0, line.length - 30)),
					});

					// Import completions when line starts with 'import'
					if (line.trim().startsWith('import')) {
						items.push(...RIPPLE_IMPORTS);
					}

					// @ accessor hint when typing after @
					if (/@\w*$/.test(line)) {
						items.push({
							label: '@value',
							kind: CompletionItemKind.Variable,
							detail: 'Access tracked value',
							documentation: 'Use @ to read/write tracked values',
						});
					}

					// Ripple keywords - extract the last word being typed
					const wordMatch = line.match(/(\w+)$/);
					const currentWord = wordMatch ? wordMatch[1] : '';

					// Debug: show what word we're matching
					log('Current word:', currentWord, 'length:', currentWord.length);

					// ALWAYS provide Ripple snippets and keywords
					// Even with 1 character, we return items so that when combined with TypeScript completions,
					// the merged result will include our items. VS Code's fuzzy matching will filter them.
					items.push(...RIPPLE_SNIPPETS);

					// Return isIncomplete=false and let VS Code handle filtering
					// Since we're providing all items every time, VS Code can cache and filter client-side
					// This works because our items have proper labels that match VS Code's fuzzy matching
					return { items, isIncomplete: currentWord.length < 2 };
				},
			};
		},
	};
}

module.exports = {
	createCompletionPlugin,
};
