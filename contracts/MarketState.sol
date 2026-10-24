// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal on-chain market state used as the S5b trust root.
/// The model input (momentum, liquidityUsd, ageMinutes) maps 1:1 to these
/// storage slots, proven by an EIP-1186 storage proof against the block's
/// state root — no trusted signer required.
contract MarketState {
    uint256 public momentumBips; // slot 0 — 1200 = 0.12
    uint256 public liquidityUsd; // slot 1 — 18400
    uint256 public ageMinutes;   // slot 2 — 45

    function set(uint256 m, uint256 l, uint256 a) external {
        momentumBips = m;
        liquidityUsd = l;
        ageMinutes = a;
    }
}
