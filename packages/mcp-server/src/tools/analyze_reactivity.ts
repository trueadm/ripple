import { z } from 'zod';
import { compile } from 'ripple/compiler';

export const AnalyzeReactivitySchema = z.object({
	code: z.string(),
});

export const ripple_analyze_reactivity = {
	name: 'ripple_analyze_reactivity',
	description: 'Analyzes Ripple code for tracked variables',
	inputSchema: {
		type: 'object',
		properties: {
			code: {
				type: 'string',
				description: 'The Ripple source code to analyze',
			},
		},
		required: ['code'],
	},
	handler: async (args: unknown) => {
		const { code } = AnalyzeReactivitySchema.parse(args);
		try {
			// Use compile to get the analyzed AST
			const result = compile(code, 'analysis.ripple', { mode: 'client' });
			const ast = result.ast;
			const trackedVariables: Array<{
				name: string;
				type: 'tracked_reference' | 'tracked_object' | 'reactive_collection';
				collectionType?: 'array' | 'object' | 'set' | 'map';
				line?: number;
			}> = [];

			const warnings: Array<{
				type: 'unescaped_string';
				message: string;
				line?: number;
				suggestion: string;
			}> = [];

			// Traverse to find tracked variables and potential issues
			function traverse(node: any) {
				if (!node) return;

				// Check for unescaped strings in JSXText nodes
				if (node.type === 'JSXText' && node.value) {
					const trimmed = node.value.trim();
					if (trimmed.length > 0) {
						warnings.push({
							type: 'unescaped_string',
							message: `Unescaped string in template: "${trimmed}"`,
							line: node.loc?.start?.line,
							suggestion: `Use {${JSON.stringify(trimmed)}} instead of ${trimmed}`,
						});
					}
				}

				// Check for variable declarations with track() calls
				if (node.type === 'VariableDeclarator') {
					if (
						node.init?.type === 'CallExpression' &&
						((node.init.callee.type === 'Identifier' &&
							(node.init.callee.name === 'track' || node.init.callee.name === 'tracked')) ||
							(node.init.callee.type === 'MemberExpression' &&
								node.init.callee.property.type === 'Identifier' &&
								(node.init.callee.property.name === 'track' ||
									node.init.callee.property.name === 'tracked')))
					) {
						if (node.id.type === 'Identifier') {
							trackedVariables.push({
								name: node.id.name,
								type: 'tracked_object',
								line: node.loc?.start?.line,
							});
						}
					}
					// Check for reactive collections (#[] and #{})
					else if (
						node.init?.type === 'TrackedArrayExpression' ||
						node.init?.type === 'TrackedObjectExpression'
					) {
						if (node.id.type === 'Identifier') {
							trackedVariables.push({
								name: node.id.name,
								type: 'reactive_collection',
								collectionType: node.init.type === 'TrackedArrayExpression' ? 'array' : 'object',
								line: node.loc?.start?.line,
							});
						}
					}
					// Check for TrackedSet, TrackedMap, new #Set(), new #Map()
					else if (node.init?.type === 'NewExpression') {
						const callee = node.init.callee;
						let collectionType: 'set' | 'map' | null = null;

						// Check for new TrackedSet() or new TrackedMap()
						if (callee.type === 'Identifier') {
							if (callee.name === 'TrackedSet') collectionType = 'set';
							else if (callee.name === 'TrackedMap') collectionType = 'map';
						}
						// Check for new #Set() or new #Map() (tracked property on Identifier)
						else if (callee.type === 'Identifier' && callee.tracked) {
							if (callee.name === 'Set') collectionType = 'set';
							else if (callee.name === 'Map') collectionType = 'map';
						}

						if (collectionType && node.id.type === 'Identifier') {
							trackedVariables.push({
								name: node.id.name,
								type: 'reactive_collection',
								collectionType,
								line: node.loc?.start?.line,
							});
						}
					}
				}

				// Check for tracked references (using @ prefix)
				if (node.type === 'Identifier' && node.tracked) {
					trackedVariables.push({
						name: node.name,
						type: 'tracked_reference',
						line: node.loc?.start?.line,
					});
				}

				// Traverse children
				for (const key in node) {
					if (key === 'metadata' || key === 'loc' || key === 'start' || key === 'end') continue;
					const child = node[key];
					if (Array.isArray(child)) {
						child.forEach(traverse);
					} else if (typeof child === 'object' && child !== null && child.type) {
						traverse(child);
					}
				}
			}

			traverse(ast);

			// Remove duplicates based on name
			const uniqueTracked = Array.from(new Map(trackedVariables.map((v) => [v.name, v])).values());

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								trackedVariables: uniqueTracked,
								warnings,
								summary: {
									total: uniqueTracked.length,
									trackedObjects: uniqueTracked.filter((v) => v.type === 'tracked_object').length,
									trackedReferences: uniqueTracked.filter((v) => v.type === 'tracked_reference')
										.length,
									reactiveCollections: uniqueTracked.filter((v) => v.type === 'reactive_collection')
										.length,
									warningsCount: warnings.length,
								},
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error: any) {
			return {
				content: [
					{
						type: 'text',
						text: `Analysis failed: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
