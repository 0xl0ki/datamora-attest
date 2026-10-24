// Compile + deploy AttestationAnchor to an RPC endpoint.
//
//   RPC_URL       (default http://127.0.0.1:8545)
//   PRIVATE_KEY   (default Hardhat account[0] key for the local node)
//
// Writes data/deployment.json (address + abi) for the server's live mode.
//   npm run deploy
import solc from 'solc';
import { ethers } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, '..', 'data');
const CONTRACTS = join(ROOT, '..', 'contracts');
mkdirSync(DATA, { recursive: true });

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const PRIVATE_KEY =
  process.env.PRIVATE_KEY ?? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const source = readFileSync(join(CONTRACTS, 'AttestationAnchor.sol'), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'AttestationAnchor.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (output.errors ?? []).filter((e) => e.severity === 'error');
if (errs.length) {
  console.error(errs.map((e) => e.formattedMessage).join('\n'));
  process.exit(1);
}
const { abi, evm } = output.contracts['AttestationAnchor.sol']['AttestationAnchor'];

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const chainId = (await provider.getNetwork()).chainId;

const factory = new ethers.ContractFactory(abi, '0x' + evm.bytecode.object, wallet);
const contract = await factory.deploy();
await contract.deployed();

writeFileSync(
  join(DATA, 'deployment.json'),
  JSON.stringify(
    {
      schema: 'attestation-deployment-v1',
      chainId,
      rpcUrl: RPC_URL,
      address: contract.address,
      deployer: await wallet.getAddress(),
      deployedAt: new Date().toISOString(),
      abi,
    },
    null,
    2,
  ),
);

console.log(`deployed AttestationAnchor @ ${contract.address} (chainId ${chainId})`);
console.log(`deployment info → data/deployment.json`);
