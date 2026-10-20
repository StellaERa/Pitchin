# Pitchin Contracts

Soroban smart contracts for Stellar. This workspace contains the current on-chain foundations and is intended to grow into the escrow and verification layer for Pitchin's neighbourhood repair board.

> **Product status:** The root README describes the target repair-board interfaces and invariants. The current Cargo workspace does not yet contain the target `IssueRegistry`, `RepairPool`, `ContractorRegistry`, or `VerificationPanel` contracts. Do not treat their described functions, error codes, or deployment IDs as implemented.

## Current Workspace

The Cargo workspace currently includes:

| Crate | Current area |
|---|---|
| `access_control` | Role and access-control primitives |
| `workspace_booking` | Resource and workspace booking workflows |
| `payment_escrow` | General-purpose escrow and payment release/refund workflows |
| `manage_hub` | Hub features including membership, staking, subscriptions, and related management operations |
| `membership_token` | Membership token functionality |
| `resource_credits` | Resource-credit functionality retained in the workspace |
| `common_types` | Shared contract types |

These are the existing platform contracts, not a complete implementation of resident repair pools. In particular, the current escrow contract should not be assumed to implement the target pledge, bid, staged payout, quorum, warranty-retention, or pro-rata refund rules.

## Target Repair-Board Contract Boundaries

The product design calls for these contract responsibilities:

| Planned contract | Intended responsibility |
|---|---|
| `IssueRegistry` | Record issue metadata commitments, coarse location, classification, and lifecycle status |
| `RepairPool` | Hold pledges, manage funding and bids, coordinate escrow, refunds, payout stages, and warranty retention |
| `ContractorRegistry` | Track contractor registration, stake, job history, and warranty outcomes |
| `VerificationPanel` | Enforce verifier eligibility, one vote per round, quorum thresholds, and outcome rewards |

Only coarse location and content hashes should be anchored on-chain. Exact coordinates, photos, and descriptions belong in off-chain storage. AI triage is advisory and must not independently authorize a payout.

The design's key invariants include full refunds for unfunded pools, no award before funding, payout totals bounded by the award, verified quorum before main payment, locked warranty retention, and eligibility/conflict checks for verifiers. These are design targets until implemented and covered by contract tests.

## Build and Test

Requirements: Rust stable, `wasm32-unknown-unknown` target, and the Stellar CLI for Soroban build/deployment workflows.

```bash
cd contracts
rustup target add wasm32-unknown-unknown
cargo test
cargo build --release --target wasm32-unknown-unknown
```

The root `contracts/` directory is a Cargo workspace. Testnet deployment scripts are in `contracts/scripts/`; deployment requires a funded Stellar Testnet account and the configuration expected by the selected script. No repair-board contract IDs are published yet.

## Amounts and Network

Contract token amounts use integer base units; Stellar assets typically use seven decimal places. Avoid floating-point arithmetic for token values. Testnet and Mainnet contract IDs, asset addresses, and any deployment-specific configuration should be recorded only after deployment and verification.

## Security and Release Readiness

Smart contracts handling pooled community funds need independent review before Mainnet use. Validate authorization, reentrancy/external token-call behavior, arithmetic bounds, storage TTL, replay protection, pause behavior, and every lifecycle transition. AI classification and off-chain indexing are not trust boundaries for fund release.

## Related Documentation

- [Root README](../README.md): product flow, target interfaces, invariants, error codes, and roadmap.
- [Backend README](../backend/README.md): REST API and off-chain application services.
- [Frontend README](../frontend/README.md): resident and contractor client direction.
- Contract-specific documentation and tests live in each crate and under `contracts/docs/`.