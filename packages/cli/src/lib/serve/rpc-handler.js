/**
 * RPC Handler for Ripple server functions
 * Handles the /_$_ripple_rpc_$_/ endpoint for server-side function calls
 */

/**
 * @typedef {import('node:http').IncomingMessage} IncomingMessage
 * @typedef {import('node:http').ServerResponse} ServerResponse
 */

/**
 * Parse the request body from an incoming message
 * @param {IncomingMessage} req - The incoming HTTP request
 * @param {number} [maxSize=1e6] - Maximum body size in bytes (default 1MB)
 * @returns {Promise<string>} - The parsed request body as a string
 */
export function parseRequestBody(req, maxSize = 1e6) {
	return new Promise((resolve, reject) => {
		let data = '';

		req.on('data', (chunk) => {
			data += chunk;
			if (data.length > maxSize) {
				req.destroy();
				reject(new Error('Request body too large'));
			}
		});

		req.on('end', () => {
			resolve(data);
		});

		req.on('error', reject);
	});
}

/**
 * Check if the request is an RPC request
 * @param {string} url - The request URL
 * @returns {boolean} - True if this is an RPC request
 */
export function isRpcRequest(url) {
	return url.startsWith('/_$_ripple_rpc_$_/');
}

/**
 * Extract the RPC hash from the URL
 * @param {string} url - The request URL
 * @returns {string} - The extracted hash
 */
export function extractRpcHash(url) {
	return url.slice('/_$_ripple_rpc_$_/'.length);
}

/**
 * Handle an RPC request
 * @param {IncomingMessage} req - The incoming HTTP request
 * @param {ServerResponse} res - The server response
 * @param {*} vite - The Vite dev server instance
 * @param {Map<string, [string, string]>} rpcModules - Map of RPC module hashes to [filePath, functionName]
 * @returns {Promise<void>}
 */
export async function handleRpcRequest(req, res, vite, rpcModules) {
	const url = req.url || '';
	const hash = extractRpcHash(url);
	const moduleInfo = rpcModules.get(hash);

	if (!moduleInfo) {
		res.writeHead(404, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'RPC function not found' }));
		return;
	}

	const [filePath, funcName] = moduleInfo;

	try {
		const { _$_server_$_: server } = await vite.ssrLoadModule(filePath);
		const { executeServerFunction } = await vite.ssrLoadModule('ripple/server');

		const rpcArguments = await parseRequestBody(req);
		const result = await executeServerFunction(server[funcName], rpcArguments);

		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(result);
	} catch (error) {
		const err = /** @type {Error} */ (error);
		console.error('RPC Error:', err);
		res.writeHead(500, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: err.message }));
	}
}
