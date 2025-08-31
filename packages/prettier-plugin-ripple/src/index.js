import { parse } from 'ripple/compiler';

export const languages = [
	{
		name: 'ripple',
		parsers: ['ripple'],
		extensions: ['.ripple'],
		vscodeLanguageIds: ['ripple']
	}
];

export const parsers = {
	ripple: {
		astFormat: 'ripple-ast',
		parse(text, parsers, options) {
			const ast = parse(text);
			
			// Ensure the AST has the required properties for Prettier
			if (!ast.comments) {
				ast.comments = [];
			}
			
			return ast;
		},
		
		locStart(node) {
			return node.start || 0;
		},
		
		locEnd(node) {
			return node.end || 0;
		}
	}
};

export const printers = {
	'ripple-ast': {
		print(path, options, print) {
			const node = path.getValue();
			return printRippleNode(node, path, options, print);
		}
	}
};

function printRippleNode(node, path, options, print) {
	if (!node || typeof node !== 'object') {
		return String(node || '');
	}

	switch (node.type) {
		case 'Program':
			return path.map(print, 'body').join('\n\n');

		case 'ImportDeclaration':
			return printImportDeclaration(node, path, options, print);

		case 'Component':
			return printComponent(node, path, options, print);

		case 'VariableDeclaration':
			return printVariableDeclaration(node, path, options, print);

		case 'ExpressionStatement':
			return path.call(print, 'expression') + ';';

		case 'JSXElement':
			return printJSXElement(node, path, options, print);

		case 'JSXFragment':
			return printJSXFragment(node, path, options, print);

		case 'JSXText':
			return node.value;

		case 'JSXExpressionContainer':
			return '{' + path.call(print, 'expression') + '}';

		case 'JSXAttribute':
			return printJSXAttribute(node, path, options, print);

		case 'UseAttribute':
			return '{@use ' + path.call(print, 'argument') + '}';

		case 'SpreadAttribute':
			return '{...' + path.call(print, 'argument') + '}';

		case 'Identifier':
			return node.name;

		case 'Literal':
			return JSON.stringify(node.value);

		case 'ArrowFunctionExpression':
			return printArrowFunction(node, path, options, print);

		case 'BlockStatement':
			return '{\n' + path.map(print, 'body').join('\n') + '\n}';

		case 'ReturnStatement':
			return 'return ' + (node.argument ? path.call(print, 'argument') : '') + ';';

		case 'BinaryExpression':
			return path.call(print, 'left') + ' ' + node.operator + ' ' + path.call(print, 'right');

		case 'UpdateExpression':
			return node.prefix ? node.operator + path.call(print, 'argument') : path.call(print, 'argument') + node.operator;

		case 'CallExpression':
			return path.call(print, 'callee') + '(' + path.map(print, 'arguments').join(', ') + ')';

		case 'MemberExpression':
			return path.call(print, 'object') + (node.computed ? '[' + path.call(print, 'property') + ']' : '.' + path.call(print, 'property'));

		case 'ObjectPattern':
			return printObjectPattern(node, path, options, print);

		case 'Property':
			return printProperty(node, path, options, print);

		case 'VariableDeclarator':
			return printVariableDeclarator(node, path, options, print);

		case 'TSTypeAnnotation':
			return ': ' + path.call(print, 'typeAnnotation');

		case 'TSTypeLiteral':
			return printTSTypeLiteral(node, path, options, print);

		case 'TSPropertySignature':
			return printTSPropertySignature(node, path, options, print);

		case 'TSStringKeyword':
			return 'string';

		case 'TSTypeReference':
			return printTSTypeReference(node, path, options, print);

		case 'Element':
			return printElement(node, path, options, print);

		case 'Attribute':
			return printAttribute(node, path, options, print);

		case 'Text':
			return '{' + path.call(print, 'expression') + '}';

		default:
			// Fallback for unknown node types
			console.warn('Unknown node type:', node.type);
			return '/* Unknown: ' + node.type + ' */';
	}
}

function printImportDeclaration(node, path, options, print) {
	let result = 'import ';
	
	// Handle type imports
	if (node.importKind === 'type') {
		result += 'type ';
	}
	
	if (node.specifiers && node.specifiers.length > 0) {
		const specifiers = node.specifiers.map(spec => {
			if (spec.type === 'ImportDefaultSpecifier') {
				return spec.local.name;
			} else if (spec.type === 'ImportSpecifier') {
				return spec.imported.name === spec.local.name 
					? spec.local.name 
					: spec.imported.name + ' as ' + spec.local.name;
			}
			return spec.local.name;
		});
		
		if (specifiers.length === 1 && node.specifiers[0].type === 'ImportDefaultSpecifier') {
			result += specifiers[0];
		} else {
			result += '{ ' + specifiers.join(', ') + ' }';
		}
		
		result += ' from ';
	}
	
	result += JSON.stringify(node.source.value) + ';';
	return result;
}

function printComponent(node, path, options, print) {
	let result = 'component ' + node.id.name;
	
	if (node.params && node.params.length > 0) {
		result += '(' + path.map(print, 'params').join(', ') + ')';
	}
	
	result += ' {\n';
	const body = path.map(print, 'body').join('\n');
	result += body.split('\n').map(line => line ? '  ' + line : line).join('\n');
	result += '\n}';
	
	return result;
}

function printVariableDeclaration(node, path, options, print) {
	const kind = node.kind || 'let';
	const declarations = path.map(print, 'declarations').join(', ');
	return kind + ' ' + declarations + ';';
}

function printJSXElement(node, path, options, print) {
	const openingElement = printJSXOpeningElement(node.openingElement, path, options, print);
	
	if (node.selfClosing || (node.children && node.children.length === 0)) {
		return openingElement.replace('>', ' />');
	}
	
	const children = node.children
		.map((child, i) => {
			if (child.type === 'JSXText') {
				return child.value.trim();
			}
			return path.call(print, 'children', i);
		})
		.filter(child => child !== '');
	
	const closingElement = '</' + node.openingElement.name.name + '>';
	
	if (children.length === 0) {
		return openingElement.replace('>', ' />');
	}
	
	if (children.length === 1 && typeof children[0] === 'string' && children[0].length < 20) {
		return openingElement + children[0] + closingElement;
	}
	
	return openingElement + '\n' + children.map(child => '  ' + child).join('\n') + '\n' + closingElement;
}

function printJSXOpeningElement(node, path, options, print) {
	let result = '<' + node.name.name;
	
	if (node.attributes && node.attributes.length > 0) {
		const attrs = node.attributes.map(attr => {
			if (attr.type === 'UseAttribute') {
				return '{@use ' + attr.argument.name + '}';
			} else if (attr.type === 'SpreadAttribute') {
				return '{...' + attr.argument.name + '}';
			} else if (attr.type === 'JSXAttribute') {
				return printJSXAttribute(attr, path, options, print);
			}
			return '';
		}).filter(attr => attr !== '');
		
		result += ' ' + attrs.join(' ');
	}
	
	result += '>';
	return result;
}

function printJSXAttribute(node, path, options, print) {
	let result = node.name.name;
	
	if (node.value) {
		if (node.value.type === 'Literal') {
			result += '=' + JSON.stringify(node.value.value);
		} else if (node.value.type === 'JSXExpressionContainer') {
			result += '={' + node.value.expression.name + '}';
		}
	}
	
	return result;
}

function printJSXFragment(node, path, options, print) {
	const children = path.map(print, 'children').join('\n');
	return '<>\n' + children + '\n</>';
}

function printArrowFunction(node, path, options, print) {
	const params = node.params.map(param => param.name).join(', ');
	const body = node.body.type === 'BlockStatement' 
		? path.call(print, 'body')
		: path.call(print, 'body');
	
	return '(' + params + ') => ' + body;
}

function printObjectPattern(node, path, options, print) {
	const properties = path.map(print, 'properties').join(', ');
	let result = '{ ' + properties + ' }';
	
	if (node.typeAnnotation) {
		result += path.call(print, 'typeAnnotation');
	}
	
	return result;
}

function printProperty(node, path, options, print) {
	if (node.shorthand) {
		return path.call(print, 'key');
	}
	
	return path.call(print, 'key') + ': ' + path.call(print, 'value');
}

function printVariableDeclarator(node, path, options, print) {
	let result = path.call(print, 'id');
	
	if (node.init) {
		result += ' = ' + path.call(print, 'init');
	}
	
	return result;
}

function printTSTypeLiteral(node, path, options, print) {
	const members = path.map(print, 'members').join('; ');
	return '{ ' + members + ' }';
}

function printTSPropertySignature(node, path, options, print) {
	let result = path.call(print, 'key');
	
	if (node.typeAnnotation) {
		result += path.call(print, 'typeAnnotation');
	}
	
	return result;
}

function printTSTypeReference(node, path, options, print) {
	return path.call(print, 'typeName');
}

function printElement(node, path, options, print) {
	const tagName = node.id.name;
	let result = '<' + tagName;
	
	if (node.attributes && node.attributes.length > 0) {
		const attrs = path.map((attrPath, index) => {
			const attr = node.attributes[index];
			if (attr.type === 'UseAttribute') {
				return '{@use ' + attr.argument.name + '}';
			} else if (attr.type === 'SpreadAttribute') {
				return '{...' + attr.argument.name + '}';
			} else {
				return attrPath.call(print);
			}
		}, 'attributes');
		result += ' ' + attrs.join(' ');
	}
	
	if (node.selfClosing || !node.children || node.children.length === 0) {
		result += ' />';
		return result;
	}
	
	result += '>';
	
	const children = path.map(print, 'children');
	const hasComplexChildren = children.some(child => 
		typeof child === 'string' && (child.includes('\n') || child.length > 50)
	);
	
	if (hasComplexChildren || children.length > 1) {
		result += '\n';
		result += children.map(child => 
			typeof child === 'string' 
				? child.split('\n').map(line => line ? '  ' + line : line).join('\n')
				: '  ' + child
		).join('\n');
		result += '\n';
	} else if (children.length === 1) {
		result += children[0];
	}
	
	result += '</' + tagName + '>';
	return result;
}

function printAttribute(node, path, options, print) {
	let result = node.name.name;
	
	if (node.value) {
		if (node.value.type === 'Literal') {
			result += '=' + JSON.stringify(node.value.value);
		} else {
			result += '={' + path.call(print, 'value') + '}';
		}
	}
	
	return result;
}