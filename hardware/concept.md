# Idea D — OSKey as your physical key in the agent economy (vision)

This is the forward-looking frame for the concept film, not a shipped feature.

## The thesis

OSKey's mission is "the key to verifying your identity in the digital world".
Datamora Attest makes *what an agent did* independently verifiable. Together,
they close the loop:

> **The operator holds a physical key; the agent acts on-chain; the proof chain
> traces every action back to that key.**

## The story (concept film scene)

1. A strategy author publishes a verifiable strategy (code hash on-chain).
2. A user, holding an OSKey, authorizes a budget + policy — by signing on the
   device (idea A/B), not by typing a hot key.
3. A service agent executes under the mandate, producing a receipt.
4. A third agent independently verifies the receipt — mandate, input proof,
   inference proof, and the Merkle anchor — and pays via x402.
5. In a dispute, the evidence chain terminates in the operator's physical key:
   "this action was authorized by *this device*, at *this block*."

## Why it matters for the pitch

- Bridges **hardware sovereignty** (OSKey) with **verifiable AI** (Attest).
- Answers the #1 objection to our demo ("the authorization key is just a demo
  key") by putting the key in a physical device the operator owns.
- Gives the "agent economy" narrative a concrete, tangible artifact the judge
  can hold, instead of an abstract cryptographic claim.

## Status

Concept only. The live demo covers ideas A/B (hardware signing + on-device
review); C (QR) is buildable; D is the "what this becomes" slide.
