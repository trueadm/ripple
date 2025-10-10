import * as devalue from 'devalue';

/**
 * @param {string} hash
 * @param {any[]} args
 */
export async function rpc(hash, args) {
	const body = devalue.stringify(args);
	let data;

	try {
		const response = await fetch('/_$_ripple_rpc_$_/' + hash, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body,
		});
		data = await response.text();
	} catch (err) {
		throw new Error('An error occurred while trying to call the server function.');
	}

	if (data === '') {
		throw new Error('The server function end-point did not return a response. Are you running a Ripple server?');
	}

	return devalue.parse(data).value;
}
