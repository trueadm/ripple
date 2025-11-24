import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, '../dist/index.js');

const server = spawn('node', [serverPath], {
	stdio: ['pipe', 'pipe', 'inherit'],
});

const requests = [
	{
		jsonrpc: '2.0',
		id: 1,
		method: 'tools/call',
		params: {
			name: 'ripple_create_component',
			arguments: {
				name: 'TestComponent',
				content: `component TestComponent() { <div>{"Test"}</div> }`,
				path: path.resolve(__dirname, '../temp'),
			},
		},
	},
	{
		jsonrpc: '2.0',
		id: 2,
		method: 'tools/call',
		params: {
			name: 'ripple_analyze_reactivity',
			arguments: {
				code: `component App() {
          let count = track(0);
          let message = track('Hello');
          let arr = #[1, 2, 3];
          let obj = #{ name: 'test' };
          let mySet = new #Set([1, 2, 3]);
          let myMap = new #Map([['a', 1]]);
          <div>{@count}{" "}{@message}{" "}{@arr[0]}</div>
        }`,
			},
		},
	},
];

// Send initialize request first
const initRequest = {
	jsonrpc: '2.0',
	id: 0,
	method: 'initialize',
	params: {
		protocolVersion: '2024-11-05',
		capabilities: {},
		clientInfo: {
			name: 'test-client',
			version: '1.0.0',
		},
	},
};

let currentRequestIndex = 0;

server.stdout.on('data', (data) => {
	const messages = data.toString().split('\n').filter(Boolean);
	for (const msg of messages) {
		try {
			const json = JSON.parse(msg);
			console.log('Received:', JSON.stringify(json, null, 2));

			if (json.id === 0) {
				// Initialized, send initialized notification and then first tool call
				server.stdin.write(
					JSON.stringify({
						jsonrpc: '2.0',
						method: 'notifications/initialized',
					}) + '\n',
				);

				server.stdin.write(JSON.stringify(requests[0]) + '\n');
			} else if (json.id === requests[currentRequestIndex].id) {
				// Tool call response
				console.log(`Request ${json.id} successful!`);
				currentRequestIndex++;

				if (currentRequestIndex < requests.length) {
					server.stdin.write(JSON.stringify(requests[currentRequestIndex]) + '\n');
				} else {
					server.kill();
					process.exit(0);
				}
			}
		} catch (e) {
			console.error('Failed to parse:', msg);
		}
	}
});

server.stdin.write(JSON.stringify(initRequest) + '\n');

setTimeout(() => {
	console.error('Timeout');
	server.kill();
	process.exit(1);
}, 5000);
