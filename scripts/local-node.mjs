// Standalone local EVM node (ganache) on http://127.0.0.1:8545.
// Uses a fixed mnemonic (Hardhat's default) so account[0] is deterministic:
//   address      0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
//   private key  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
//   npm run local:node
import ganache from 'ganache';

const MNEMONIC = 'test test test test test test test test test test test junk';
const PORT = Number(process.env.PORT ?? 8545);

const server = ganache.server({
  wallet: { mnemonic: MNEMONIC, totalAccounts: 10, defaultBalance: 1000 },
  chain: { chainId: 4663, hardfork: 'shanghai' },
  logging: { quiet: false },
});

server.listen(PORT, () => {
  console.log(`local EVM → http://127.0.0.1:${PORT} (chainId 4663, mnemonic "test test … junk")`);
});
