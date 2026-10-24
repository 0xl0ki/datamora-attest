// Mainnet anchoring from the VM.
//
// The VM's Node processes cannot reach the mainnet RPC directly (its undici
// fetch ignores the HTTP proxy), but `curl` respects the proxy. So we sign
// offline with ethers and broadcast via curl — this works on the VM.
import { execFileSync } from 'node:child_process';

export const MAINNET_RPC = 'https://rpc.mainnet.chain.robinhood.com';
export const MAINNET_CONTRACT = '0x77aD16FE64c5A0Bc499d00aD48025Fe3D885b7f9';

export function rpcCallViaCurl(method, params, rpc = MAINNET_RPC) {
  const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const out = execFileSync(
    'curl', ['-s', '--max-time', '20', '-X', 'POST', rpc, '-H', 'content-type: application/json', '-d', payload],
    { encoding: 'utf8' },
  );
  const j = JSON.parse(out);
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result;
}

export function sendRawTxViaCurl(rawTx, rpc = MAINNET_RPC) {
  return rpcCallViaCurl('eth_sendRawTransaction', [rawTx], rpc);
}

export async function mainnetAttest(root, { privateKey, contract = MAINNET_CONTRACT, gasLimit = 300000 }) {
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(privateKey);
  const nonce = parseInt(rpcCallViaCurl('eth_getTransactionCount', [wallet.address, 'latest']), 16);
  const iface = new ethers.utils.Interface(['function attest(bytes32 root)']);
  const data = iface.encodeFunctionData('attest', ['0x' + String(root).replace(/^0x/, '')]);
  const tx = await wallet.signTransaction({
    chainId: 4663, to: contract, data, gasLimit,
    maxFeePerGas: 100000000, maxPriorityFeePerGas: 20000000, nonce, type: 2,
  });
  const txHash = sendRawTxViaCurl(tx);
  return { txHash, root, contract, network: 'robinhood-mainnet', chainId: 4663 };
}
