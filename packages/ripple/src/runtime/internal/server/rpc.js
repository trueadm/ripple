import * as devalue from 'devalue';

/**
 * @template {any[]} T
 * @template V
 * @param {(...args: T) => Promise<V>} fn 
 * @param {string} rpc_arguments_string
 */
export async function executeServerFunction(fn, rpc_arguments_string) {
  const rpc_arguments = devalue.parse(rpc_arguments_string);
  const result = await fn.apply(null, rpc_arguments);
	return devalue.stringify({ value: result });
}