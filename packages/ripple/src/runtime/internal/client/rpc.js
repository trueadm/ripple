
/**
 * @param {string} hash 
 * @param {any[]} args 
 */
export function rpc(hash, args) {
  return fetch('/_$_ripple_rpc_$_/' + hash, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  }).then(res => res.json());
}