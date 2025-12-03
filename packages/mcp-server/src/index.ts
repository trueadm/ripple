#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ErrorCode,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	McpError,
	ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { compile } from 'ripple/compiler';
import fs from 'fs/promises';
import { tools } from './tools/index.js';

const server = new Server(
	{
		name: '@ripple-ts/mcp-server',
		version: '0.0.1',
	},
	{
		capabilities: {
			resources: {},
			tools: {},
		},
	},
);

// Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
		})),
	};
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const tool = tools.find((t) => t.name === request.params.name);

	if (tool) {
		return await tool.handler(request.params.arguments);
	}

	throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});

// Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
	return {
		resources: [
			{
				uri: 'ripple://compiled/{path}',
				name: 'Compiled Ripple File',
				description: 'Reads a local file, compiles it, and returns the JS output',
				mimeType: 'application/javascript',
			},
		],
	};
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
	const url = new URL(request.params.uri);
	if (url.protocol !== 'ripple:') {
		throw new McpError(ErrorCode.InvalidRequest, `Invalid protocol: ${url.protocol}`);
	}

	if (url.hostname === 'compiled') {
		const filePath = url.pathname;

		try {
			const code = await fs.readFile(filePath, 'utf-8');
			const result = compile(code, filePath, { mode: 'client' });
			return {
				contents: [
					{
						uri: request.params.uri,
						mimeType: 'application/javascript',
						text: result.js.code,
					},
				],
			};
		} catch (error: any) {
			throw new McpError(
				ErrorCode.InternalError,
				`Failed to compile file ${filePath}: ${error.message}`,
			);
		}
	}

	throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${request.params.uri}`);
});

async function run() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Ripple MCP Server running on stdio');
}

run().catch((error) => {
	console.error('Fatal error running server:', error);
	process.exit(1);
});
