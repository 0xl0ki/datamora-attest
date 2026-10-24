// Fetch a real eth_getProof fixture from the local chain and save it.
import solc from 'solc';
import { ethers } from 'ethers';
import { readFileSync, writeFileSync } from 'node:fs';

const RPC = 'http://127.0.0.1:8545';
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const source = readFileSync('./contracts/MarketState.sol', 'utf8');
const input = { language: 'Solidity', sources: { 'MarketState.sol': { content: source } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const { abi, evm } = out.contracts['MarketState.sol'].MarketState;

const provider = new ethers.providers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(KEY, provider);
const factory = new ethers.ContractFactory(abi, '0x' + evm.bytecode.object, wallet);
const c = await factory.deploy();
await c.deployed();
console.log('MarketState @', c.address);

// set slot0=1200, slot1=18400, slot2=timestamp
const ageMinutes = 45;
await (await c.set(1200, 18400, ageMinutes)).wait();
console.log("set storage done; ageMinutes", ageMinutes);

const block = await provider.getBlock('latest');
const slots = [
  '0x' + (0).toString(16).padStart(64, '0'),
  '0x' + (1).toString(16).padStart(64, '0'),
  '0x' + (2).toString(16).padStart(64, '0'),
];
const proof = await provider.send('eth_getProof', [c.address, slots, 'latest']);
const fixture = {
  address: c.address,
  blockNumber: block.number,
  blockHash: block.hash,
  stateRoot: block.stateRoot,   // ethers v5 doesn't expose stateRoot on getBlock; fetch raw
  accountProof: proof.accountProof,
  storageProof: proof.storageProof,
  storageHash: proof.storageHash,
};
// get stateRoot via raw block (ethers strips it)
const rawBlock = await provider.send('eth_getBlockByNumber', ['latest', false]);
fixture.stateRoot = rawBlock.stateRoot;
writeFileSync('data/stateproof-fixture.json', JSON.stringify(fixture, null, 2));
console.log('stateRoot', fixture.stateRoot);
console.log('storageHash', fixture.storageHash);
console.log('saved data/stateproof-fixture.json');
