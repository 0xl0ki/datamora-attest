// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Tamper-evident anchor for agent-execution receipt batches.
/// @dev Off-chain receipts self-verify via sha256 (canonical JSON). The Merkle
/// root of a batch of receipt digests is committed here, giving every receipt
/// a verifiable on-chain timestamp. Roots are keccak256 sorted-pair Merkle
/// roots (EVM native), so `verifyProof` can prove single-receipt membership
/// on-chain with no trusted registry.
contract AttestationAnchor {
    uint256 public totalAttestations;

    mapping(uint256 => bytes32) public roots;           // id -> merkle root
    mapping(uint256 => uint256) public timestamps;      // id -> block.timestamp
    mapping(bytes32 => uint256) public firstAttestedAt; // root -> first block.timestamp
    mapping(bytes32 => address) public attestedBy;      // root -> first attester
    mapping(bytes32 => uint256) public attestationCount;

    event Attested(uint256 indexed id, bytes32 indexed root, address indexed by, uint256 timestamp);

    /// @notice Anchor a batch root. Re-anchoring the same root only bumps the
    /// count; first-attestation metadata is immutable.
    function attest(bytes32 root) external {
        if (firstAttestedAt[root] == 0) {
            firstAttestedAt[root] = block.timestamp;
            attestedBy[root] = msg.sender;
        }
        attestationCount[root]++;
        uint256 id = ++totalAttestations;
        roots[id] = root;
        timestamps[id] = block.timestamp;
        emit Attested(id, root, msg.sender, block.timestamp);
    }

    function isAnchored(bytes32 root) external view returns (bool) {
        return firstAttestedAt[root] != 0;
    }

    /// @notice Sorted-pair hash, matching the off-chain JS `pairHash`
    /// (keccak256 of the two 32-byte values ordered lexicographically).
    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(a < b ? a : b, a < b ? b : a));
    }

    /// @notice Prove a leaf is part of a (possibly unanchored) Merkle root.
    function verifyProof(bytes32 leaf, bytes32[] calldata proof, bytes32 root)
        external
        pure
        returns (bool)
    {
        return _verifyProof(leaf, proof, root);
    }

    /// @notice Prove a receipt digest belongs to an already-anchored batch.
    function verifyReceipt(bytes32 root, bytes32 leaf, bytes32[] calldata proof)
        external
        view
        returns (bool)
    {
        return firstAttestedAt[root] != 0 && _verifyProof(leaf, proof, root);
    }

    function _verifyProof(bytes32 leaf, bytes32[] calldata proof, bytes32 root)
        internal
        pure
        returns (bool)
    {
        bytes32 h = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            h = _pair(h, proof[i]);
        }
        return h == root;
    }
}
