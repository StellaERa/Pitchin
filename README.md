# Pitchin

**A neighbourhood repair board where residents report local problems, pool money to fix them, and pay contractors only when their neighbours confirm the work is done, with every pledge and payout held on Stellar.**

Spot a pothole, a dead streetlight, or a blocked drain. Post a photo, let AI triage it, and watch neighbours chip in USDC to a repair pool. Local contractors bid, funds sit in escrow, and payment is released when a quorum of nearby residents verify the fix. A retention is held back for a warranty period, so a bad repair costs the contractor.

![License: MIT](https://img.shields.io/badge/License-MIT-green) ![Network: Stellar](https://img.shields.io/badge/Network-Stellar-blue) ![Contracts: Soroban](https://img.shields.io/badge/Contracts-Soroban-purple) ![Monorepo: pnpm](https://img.shields.io/badge/Monorepo-pnpm-orange) ![Build: Turborepo](https://img.shields.io/badge/Build-Turborepo-red)

> **Status:** early design and Testnet development. The function tables, invariants, and error codes below describe the target interface. Items marked *planned* are not yet implemented.

---

## The Problem

Small infrastructure failures are everywhere and rarely get fixed.

- A pothole, a broken streetlight, or a collapsed culvert affects hundreds of people, but nobody owns the problem. Everyone assumes someone else will report it, pay for it, or fix it.
- When neighbours do try to pool money, the collection is informal. Someone ends up holding cash, nobody can see where it went, and contributors have no way to know if the work was done properly.
- Contractors who do honest work have no portable track record, so residents cannot tell a reliable repairer from a one-off opportunist.
- A bad repair that fails after two rains costs the neighbourhood twice, and nobody is accountable.

## The Solution

Pitchin turns "someone should fix that" into a funded, verifiable job.

1. **Report.** A resident posts a geotagged photo. AI categorises the problem, estimates severity, and merges duplicates so the same pothole does not get reported fifty times.
2. **Pool.** Neighbours pledge USDC to a repair pool with a funding goal and a deadline. If the goal is not met, everyone is refunded in full.
3. **Bid.** Registered, staked contractors submit bids. The pool picks one (by pledger vote, or automatically by the lowest qualified bid).
4. **Verify.** When the work is done, the contractor uploads after-photos. A quorum of nearby, staked neighbours reviews them. Only then is payment released.
5. **Warranty.** A retention stays locked for a warranty period. If the repair fails, neighbours can flag it and the retention funds a re-repair.

---

## Core Features

### Reporting and Funding
- Geotagged issue reports with photos, categories (road, drainage, lighting, walkway, public space), and severity
- Duplicate detection so one problem gets one pool
- Repair pools with goals, deadlines, and full refunds on failure
- **Match pools:** local businesses, estate associations, or councils can sponsor a category or area and match resident pledges
- Pledge from any Stellar wallet, in USDC or XLM

### Contractors and Reputation
- Contractor profiles with specialisations, service area, stake, and completed-job history
- Public **Durability Score**: the share of a contractor's repairs that survived their warranty period
- Bid board with itemised quotes and timelines

### AI Features (Pitchin Triage)
| Feature | What it does |
|---|---|
| **Photo Triage** | Reads an issue photo and suggests a category, severity, and a plain-language description |
| **Duplicate Merge** | Links new reports to existing issues in the same area, using location and image similarity |
| **Scope Drafting** | Turns a report into a clear job description contractors can price |
| **Cost Range** | Suggests a typical cost range from past completed jobs in the area, so pools set realistic goals |
| **Before/After Check** | Compares a before photo and an after photo, and flags when they do not appear to show the same place or when the problem still looks present |
| **Fraud Detection** | Flags reused photos, edited images, colluding bids, and suspicious verifier patterns |

AI output is advisory. It helps people decide, but money is only released by contract rules and human verification.

### Unique Feature 1: Neighbour Quorum Verification
Payment is released only when a quorum of verified local residents approves the completed work.

- Verifiers are residents who have pledged to a pool in that area or who have registered and staked in that location cell
- Each verifier reviews the before photo, the after photo, and the scope, then votes once
- A threshold of approvals is needed, and verifiers who vote with the final outcome earn a small reward from the platform fee
- Verifiers who repeatedly vote against the outcome lose reputation and, if they are clearly abusive, part of their stake

### Unique Feature 2: Warranty Holdback
Ten percent (configurable) of every contractor payment is held back for a warranty period, for example 90 days.

- If neighbours report a failure and a quorum confirms it, the retention is forfeited and funds a re-repair
- If nothing is reported, the retention is released automatically
- The outcome feeds the contractor's public Durability Score

---

## Monorepo Structure

```
pitchin/
├── packages/
│   ├── contracts/      # @pitchin/contracts - Soroban smart contracts (Rust)
│   ├── triage/         # @pitchin/triage    - AI photo triage, duplicate merge, before/after check
│   ├── indexer/        # @pitchin/indexer   - Event indexer for the app and API (TypeScript)
│   ├── api/            # @pitchin/api       - REST API (Node.js)
│   ├── sdk/            # @pitchin/sdk       - TypeScript SDK for contracts and API
│   └── app/            # @pitchin/app       - Resident and contractor PWA (Next.js)
├── docs/               # Architecture, threat model, verification protocol, SECURITY_MODEL.md
├── scripts/            # Testnet bootstrap, seed data, deploy helpers
├── audits/             # Smart contract audit reports
├── pnpm-workspace.yaml
├── turbo.json
└── README.md           <- you are here
```

---

## How It Works

```
Resident            Triage (AI)           Stellar Ledger               Contractor        Neighbours
   │                    │                       │                          │                 │
   ├─ post photo ──────▶│ categorise, dedupe    │                          │                 │
   │                    ├─ create issue ───────▶ IssueRegistry.report()     │                 │
   ├─ open pool ───────────────────────────────▶ RepairPool.open()         │                 │
   │                                            │◀──────── pledge() ───────────────────────────┤
   │                                            │ goal reached -> Funded    │                 │
   │                                            │◀──────── bid() ──────────┤                 │
   ├─ award ───────────────────────────────────▶ RepairPool.award()        │                 │
   │                                            ├─ advance (20%) ──────────▶│                 │
   │                                            │◀──── submit_completion() ─┤ (after photos)   │
   │                                            │◀─────────────────────────────── vote() ─────┤
   │                                            │ quorum met -> release     │                 │
   │                                            ├─ payment (70%) ──────────▶│                 │
   │                                            │ warranty period (10% held)│                 │
   │                                            │◀─────────── flag_failure() ─────────────────┤
   │                                            │ no failure -> retention ─▶│                 │
```

---

## Packages

### @pitchin/contracts
Soroban smart contracts in Rust, deployable to Stellar Testnet and Mainnet.

| Contract | Purpose |
|---|---|
| `IssueRegistry` | Reported issues with coarse location, category, photo hashes, and status |
| `RepairPool` | Pledges, bids, escrow, staged payouts, refunds, and warranty retention |
| `ContractorRegistry` | Contractor stake, service areas, completed jobs, and Durability Score |
| `VerificationPanel` | Verifier eligibility, stake, voting, quorum, and rewards |

```
packages/contracts/
├── contracts/
│   ├── issue-registry/
│   ├── repair-pool/
│   ├── contractor-registry/
│   ├── verification-panel/
│   └── common/              # Shared error enum
├── tests/
├── Cargo.toml
└── README.md
```
**Stack:** Rust, Soroban SDK, Stellar CLI

**Privacy note:** only a coarse location cell (a geohash of about 1 km) is stored on-chain. Exact coordinates, photos, and descriptions are stored off-chain, and only their hashes are anchored. Faces and number plates are blurred before upload.

#### IssueRegistry

| Function | Purpose |
|---|---|
| `initialize(admin, triage_signer)` | Sets the admin and the key used to attest AI triage results |
| `report(reporter, cell, category, severity, photo_hash, meta_hash) -> u64` | Records an issue and returns its `issue_id`. Reporter auth required. Rate-limited per reporter |
| `attach_triage(issue_id, category, severity, attestation)` | Triage signer attaches a verified AI classification |
| `mark_duplicate(issue_id, canonical_id)` | Links a duplicate to an existing issue. Triage signer or admin |
| `set_status(issue_id, status)` | Called by `RepairPool` as an issue moves through its lifecycle |
| `get_issue(issue_id) -> Issue` | Read-only |
| `get_issues_in_cell(cell, category) -> Vec<u64>` | Read-only |
| `extend_issue_ttl(issue_id)` | Extends TTL to prevent archival. Publicly callable |

#### RepairPool

| Function | Purpose |
|---|---|
| `__constructor(PoolConfig)` | Sets admin, token, fee, quorum parameters, advance and retention rates, and contract addresses in one call |
| `open(issue_id, goal, funding_deadline_ledger, scope_hash, award_mode) -> u64` | Opens a pool for an issue. Returns `pool_id`. Opener auth required |
| `pledge(pool_id, from, amount)` | Adds a pledge. Funds are held by the contract |
| `withdraw_pledge(pool_id, from, amount)` | Pledger withdraws before the pool is funded |
| `sponsor_match(pool_id, sponsor, rate_bps, cap)` | Registers a matching sponsor who matches resident pledges up to a cap. Sponsor auth required |
| `refund_unfunded(pool_id)` | After the deadline, returns all pledges if the goal was not reached. Publicly callable |
| `submit_bid(pool_id, contractor, amount, duration_ledgers, quote_hash)` | A registered contractor bids. Bid must not exceed the funded amount |
| `award(pool_id, bid_id)` | Awards the job. Opener or pledger vote depending on `award_mode` |
| `release_advance(pool_id)` | Pays the mobilisation advance (capped) to the contractor after award |
| `submit_completion(pool_id, after_photo_hash, notes_hash)` | Contractor submits proof of completed work. Opens the verification window |
| `finalize_verification(pool_id)` | Reads the `VerificationPanel` result. On approval, pays the main payment and starts the warranty clock. On rejection, opens the rework window |
| `submit_rework(pool_id, after_photo_hash)` | Contractor resubmits after a rejection |
| `claim_warranty_retention(pool_id)` | Contractor claims the retention after the warranty period if no failure was confirmed |
| `flag_failure(pool_id, evidence_hash)` | A verifier flags a failed repair within the warranty period |
| `settle_failure(pool_id)` | Reads the panel result on a flagged failure. If confirmed, forfeits the retention to a re-repair fund |
| `refund_surplus(pool_id)` | Returns unspent funds pro rata to pledgers after settlement |
| `get_pool(pool_id) -> Pool` | Read-only |
| `get_pledge(pool_id, pledger) -> i128` | Read-only |
| `get_user_nonce(caller) -> u64` | Read-only replay-protection nonce |
| `pause()` / `unpause()` | Emergency stop. Admin auth required |

#### ContractorRegistry

| Function | Purpose |
|---|---|
| `register(contractor, specialisations, cells, stake)` | A contractor stakes USDC and registers. Contractor auth required |
| `add_stake(contractor, amount)` / `withdraw_stake(contractor, amount)` | Manages stake. Withdrawal is blocked while jobs are open |
| `record_completion(contractor, pool_id, outcome)` | Called only by `RepairPool` to update job history |
| `record_warranty_result(contractor, pool_id, survived)` | Called only by `RepairPool` to update the Durability Score |
| `slash(contractor, amount, reason)` | Called by `RepairPool` for confirmed fraud or abandoned jobs |
| `get_contractor(contractor) -> ContractorInfo` | Read-only |
| `get_durability_score(contractor) -> u32` | Read-only, basis points of repairs that survived their warranty |

#### VerificationPanel

| Function | Purpose |
|---|---|
| `register_verifier(verifier, cell, stake)` | A resident stakes and registers for a location cell. Verifier auth required |
| `open_round(pool_id, cell, round_kind, deadline_ledger)` | Opens a round (`completion` or `warranty`). Called only by `RepairPool` |
| `vote(pool_id, round, approve, evidence_hash)` | An eligible verifier casts one vote |
| `close_round(pool_id, round) -> Outcome` | Tallies the vote once the deadline passes or quorum is reached. Publicly callable |
| `claim_reward(pool_id, round)` | Verifiers who voted with the outcome claim a reward |
| `slash_verifier(verifier, amount, reason)` | Admin or arbiter slashes provably abusive verifiers |
| `get_round(pool_id, round) -> Round` | Read-only |
| `is_eligible(verifier, cell) -> bool` | Read-only |

#### Enforced Invariants and Test Mapping
Each invariant below is a design target and will be covered by the named tests.

**RepairPool**

- **Full refund if unfunded**: if the goal is not reached by the deadline, every pledge can be refunded in full (`NotUnfunded` if it was funded, `FundingDeadlineNotReached` before the deadline). Test: `contracts/repair-pool/src/test.rs -> test_refund_unfunded_after_deadline`, `test_refund_before_deadline_fails`
- **Withdraw only before funded**: a pledger can withdraw until the pool is funded, never after (`PoolAlreadyFunded`). Test: `test_withdraw_before_funded_succeeds`, `test_withdraw_after_funded_fails`
- **No award before funded**: a bid cannot be awarded until the pool is funded (`NotFunded`). Test: `test_award_before_funded_fails`
- **Bid ceiling**: a bid cannot exceed the funded amount (`BidExceedsPool`). Test: `test_bid_above_pool_fails`
- **Registered contractors only**: only a registered, staked contractor can bid (`ContractorNotRegistered`). Test: `test_bid_requires_registered_contractor`
- **Staged payout never exceeds the award**: advance + main payment + retention equals the bid amount exactly (`ExceedsAward`). Test: `test_payout_stages_sum_to_award`, `test_advance_above_cap_fails`
- **Payment needs a verified quorum**: the main payment cannot be released without an approved verification round (`NotVerified`). Test: `test_payment_without_quorum_fails`, `test_payment_after_approval_succeeds`
- **Rework then refund**: after a rejection the contractor gets one rework window; if the second round also fails, remaining funds are refundable and part of the stake is slashed (`ReworkWindowClosed`). Test: `test_rework_window_after_rejection`, `test_second_rejection_refunds_pool`
- **Retention lock**: the retention cannot be claimed before the warranty period ends (`WarrantyNotElapsed`). Test: `test_retention_before_warranty_fails`, `test_retention_after_warranty_succeeds`
- **Failure forfeits retention**: a confirmed failure sends the retention to the re-repair fund, not the contractor (`NoConfirmedFailure` if not confirmed). Test: `test_confirmed_failure_forfeits_retention`
- **Surplus returns pro rata**: unspent funds go back to pledgers in proportion to their pledges. Test: `test_surplus_refunded_pro_rata`
- **Match caps**: sponsor matching never exceeds the sponsor's cap (`MatchCapExceeded`). Test: `test_sponsor_match_respects_cap`
- **Replay protection**: state-changing calls require the current nonce (`InvalidNonce`). Test: `test_replay_with_old_nonce_fails`
- **Pausable**: operations halt when paused (`Paused`). Test: `test_pledge_when_paused_fails`, `test_award_when_paused_fails`

**VerificationPanel**

- **One vote each**: a verifier can vote only once per round (`AlreadyVoted`). Test: `test_double_vote_fails`
- **Local verifiers only**: only verifiers registered in the pool's cell can vote (`NotEligibleForCell`). Test: `test_vote_from_other_cell_fails`
- **Contractor cannot verify**: a contractor, or anyone linked to the awarded bid, cannot vote on their own job (`ConflictOfInterest`). Test: `test_contractor_cannot_vote_own_job`
- **Quorum and threshold**: a round needs a minimum number of votes and a minimum approval ratio to approve (`QuorumNotMet`). Test: `test_round_without_quorum_fails`, `test_round_approves_at_threshold`
- **Rewards only for the winning side**: verifiers who voted against the outcome cannot claim (`NotEligibleForReward`). Test: `test_losing_voter_cannot_claim`

**ContractorRegistry**

- **Updates only from RepairPool**: job history and Durability Score cannot be written by anyone else (`Unauthorized`). Test: `test_record_completion_requires_pool`
- **Stake locked while working**: stake cannot be withdrawn while the contractor has open jobs (`StakeLocked`). Test: `test_withdraw_stake_with_open_job_fails`

**IssueRegistry**

- **Duplicate control**: an identical open issue in the same cell and category is rejected or linked (`DuplicateIssue`). Test: `test_duplicate_report_rejected`
- **Report rate limit**: a reporter cannot exceed the report limit per window (`ReportRateLimited`). Test: `test_report_rate_limit`

### Events

| Event | Topics | Data |
|---|---|---|
| `IssueReportedEvent` | `("issue_reported_event", issue_id)` | `reporter`, `cell`, `category`, `severity`, `photo_hash`, `ledger` |
| `IssueStatusEvent` | `("issue_status_event", issue_id)` | `previous`, `new`, `ledger` |
| `PoolOpenedEvent` | `("pool_opened_event", pool_id)` | `issue_id`, `goal`, `funding_deadline_ledger` |
| `PledgeEvent` | `("pledge_event", pool_id)` | `from`, `amount`, `total_pledged`, `ledger` |
| `PoolFundedEvent` | `("pool_funded_event", pool_id)` | `total`, `ledger` |
| `BidEvent` | `("bid_event", pool_id)` | `bid_id`, `contractor`, `amount`, `duration_ledgers` |
| `AwardEvent` | `("award_event", pool_id)` | `bid_id`, `contractor`, `amount` |
| `CompletionSubmittedEvent` | `("completion_submitted_event", pool_id)` | `after_photo_hash`, `ledger` |
| `VoteEvent` | `("vote_event", pool_id)` | `round`, `verifier`, `approve` |
| `RoundClosedEvent` | `("round_closed_event", pool_id)` | `round`, `outcome`, `approvals`, `rejections` |
| `PayoutEvent` | `("payout_event", pool_id)` | `stage` (advance / main / retention), `amount`, `contractor` |
| `RetentionForfeitedEvent` | `("retention_forfeited_event", pool_id)` | `amount`, `ledger` |
| `RefundEvent` | `("refund_event", pool_id)` | `to`, `amount`, `reason` |

Indexers should key pool events on `pool_id` and issue events on `issue_id`.

### Error Codes
Every contract returns errors from a single shared enum in `contracts/common`. Codes are stable: new variants are appended with fresh values and never renumbered.

| Code | Variant | Meaning |
|---|---|---|
| 1 | `AlreadyInitialized` | Initialisation attempted twice |
| 2 | `NotInitialized` | Call made before initialisation |
| 3 | `Unauthorized` | Caller lacks the required authority |
| 4 | `Paused` | Contract is paused |
| 5 | `InvalidAmount` | Amount was not strictly positive |
| 6 | `InvalidNonce` | Replay-protection nonce did not match |
| 100 | `DuplicateIssue` | An identical open issue already exists |
| 101 | `ReportRateLimited` | Reporter exceeded the report limit |
| 102 | `IssueNotFound` | No such issue |
| 200 | `PoolNotFound` | No such pool |
| 201 | `PoolAlreadyFunded` | Action not allowed once funded |
| 202 | `NotFunded` | Action requires a funded pool |
| 203 | `FundingDeadlineNotReached` | Refund attempted before the deadline |
| 204 | `NotUnfunded` | Refund attempted on a funded pool |
| 205 | `BidExceedsPool` | Bid is above the funded amount |
| 206 | `ExceedsAward` | Payouts would exceed the awarded amount |
| 207 | `NotVerified` | Payment attempted without an approved round |
| 208 | `ReworkWindowClosed` | Rework attempted after the window |
| 209 | `WarrantyNotElapsed` | Retention claimed too early |
| 210 | `NoConfirmedFailure` | Failure settlement without a confirmed failure |
| 211 | `MatchCapExceeded` | Sponsor match would exceed the cap |
| 300 | `ContractorNotRegistered` | Contractor is not registered or staked |
| 301 | `StakeLocked` | Stake tied to open jobs |
| 302 | `InsufficientStake` | Stake below the required minimum |
| 400 | `AlreadyVoted` | Verifier already voted this round |
| 401 | `NotEligibleForCell` | Verifier is not registered in this cell |
| 402 | `ConflictOfInterest` | Voter is linked to the job |
| 403 | `QuorumNotMet` | Not enough votes to decide |
| 404 | `NotEligibleForReward` | Verifier did not vote with the outcome |
| 405 | `RoundNotOpen` | Round is closed or not yet opened |

### Storage and TTL
Soroban archives entries that are not kept alive. Issues, pools, and rounds use a TTL strategy that keeps active records in persistent storage for about 30 days (~518,400 ledgers). Warranty periods are longer than this, so the indexer extends TTL for every pool with an open warranty. Anyone can call the public `extend_*_ttl` functions to prevent archival.

### Amount Semantics
All amounts are integer token base units (`i128`). No floating-point arithmetic is used.

| Unit | Base units |
|---|---|
| 1 stroop (smallest) | 1 |
| 1 token (USDC or XLM) | 10_000_000 |
| 50 USDC | 500_000_000 |

Percentages (advance, retention, fees, matching) are stored in basis points. 10% is `1_000` bps. Durations such as the funding deadline and the warranty period are in Stellar ledgers, about 5 seconds each. For example, a 90-day warranty is roughly 1,555,200 ledgers.

---

### @pitchin/triage
The AI layer. Takes a photo and a coarse location, and returns a structured, signed classification.

```
packages/triage/
├── src/
│   ├── classify.ts        # Photo -> category, severity, description
│   ├── duplicates.ts      # Location + image similarity merge
│   ├── scope.ts           # Report -> contractor-ready job description
│   ├── cost_range.ts      # Past-job based cost suggestions
│   ├── before_after.ts    # Same-place and fixed-or-not comparison
│   ├── fraud.ts           # Reused photos, edits, collusion patterns
│   ├── redact.ts          # Face and number-plate blurring
│   └── attest.ts          # Signs results for IssueRegistry
├── evals/                 # Labelled photos and expected outputs
├── prompts/
└── package.json
```
**Stack:** TypeScript, Python image workers, vision model API, perceptual hashing. Faces and plates are blurred before any image leaves the device or reaches a model.

### @pitchin/indexer
Streams contract events into PostgreSQL, keeps TTLs extended for open warranties, and serves the app and API.

```
packages/indexer/
├── src/
│   ├── listener.ts         # Horizon / RPC event streaming
│   ├── projections.ts      # Pools, pledges, bids, rounds
│   ├── ttl_keeper.ts       # Extends TTL for open pools and warranties
│   └── metrics.ts          # Prometheus exporter
├── Dockerfile
└── package.json
```

### @pitchin/api
```
GET   /v1/issues?lat=&lng=&radius=            Issues near a location
GET   /v1/issues/:id                          One issue with photos and status
GET   /v1/pools/:id                           Pool, pledges, bids, and verification status
GET   /v1/contractors                         Search by area and specialisation
GET   /v1/contractors/:address                Profile, jobs, Durability Score
GET   /v1/areas/:cell/stats                   Fixed vs open issues, funds raised, median repair time
POST  /v1/issues                              Create an issue with photo (wallet auth)
POST  /v1/triage                              Run AI triage on a photo (authenticated)
POST  /v1/uploads                             Upload a photo to storage and return its hash
```
**Stack:** Node.js, Fastify, PostgreSQL, Redis, IPFS or S3-compatible storage, @stellar/stellar-sdk

### @pitchin/sdk
```ts
import { Pitchin } from "@pitchin/sdk";

const pi = new Pitchin({ network: "testnet" });
const issue = await pi.issues.report({ photo, location, category });
const pool = await pi.pools.open({ issueId: issue.id, goal: "500", deadline: "14d" });
await pi.pools.pledge(pool.id, "25");
```

### @pitchin/app
A mobile-first PWA for residents and contractors.

| Route | Description |
|---|---|
| `/` | Map of issues near you, coloured by status |
| `/report` | Photo capture, AI triage, and submit |
| `/issue/:id` | Issue details, pool progress, and pledge button |
| `/pool/:id` | Bids, award, progress, and verification |
| `/verify` | Queue of completed jobs in your area to review |
| `/contractors` | Search and compare contractors by Durability Score |
| `/area/:cell` | Neighbourhood dashboard: fixed, funded, and open issues |
| `/wallet` | Pledges, refunds, and verifier rewards |
| `/contractor` | Contractor workspace: bids, jobs, stake, and payouts |

**Stack:** Next.js 14, TailwindCSS, MapLibre, @stellar/stellar-sdk, Freighter / LOBSTR / xBull wallet support. Reporting works offline and syncs when a connection returns.

---

## Why Stellar?

- **Micro-pledges are viable.** A resident can pledge 2 USDC. Near-zero fees make small contributions worthwhile.
- **Native USDC.** Pledges and payouts are in a stable asset, so a 50 USDC repair stays 50 USDC.
- **Transparent escrow.** Every pledge, bid, payout, and refund is public, which replaces the cash-in-someone's-pocket problem.
- **Soroban logic.** Staged payouts, warranty holdbacks, and quorum votes are enforced by open, auditable contracts.
- **Global reach.** Diaspora members can pledge to a hometown repair from anywhere.

---

## Threat Model and Honest Limits

| Risk | Mitigation |
|---|---|
| **Fake issues or spam** | Report rate limits, duplicate merge, and AI triage flagging reused or edited photos |
| **Contractor submits a fake after-photo** | Before/after AI comparison, perceptual-hash checks for reused images, and neighbour quorum review |
| **Verifier collusion** | Verifier stake, conflict-of-interest checks, random verifier sampling, and reputation penalties |
| **Sybil verifiers** | Verifiers stake and must hold a pledge or an area registration, so mass fake accounts cost money |
| **Location spoofing** | Coarse on-chain cell plus photo metadata checks. This reduces but cannot eliminate spoofing |
| **Contractor abandons the job** | Only a capped advance is paid up front, the rest is released after verification, and stake can be slashed |
| **Bad repair that fails later** | Warranty holdback and the public Durability Score |
| **Privacy** | Only a coarse cell is on-chain, photos are off-chain with hashes anchored, and faces and plates are blurred |

Known limits:
- **Not a replacement for public authorities.** Pitchin helps communities fund and verify small repairs. It does not remove a government's responsibility for public infrastructure.
- **Safety and permits.** Some work, especially on main roads, needs permission from the responsible authority and must follow safety rules. Pools in those categories require a permit upload, and contractors are responsible for legal compliance and safe working.
- **Human verification is not perfect.** A quorum of neighbours can still be wrong or biased. The warranty period and dispute process exist to catch mistakes after the fact.
- **AI can be wrong.** Triage and before/after checks are advisory and never release funds on their own.

Full details are in `docs/SECURITY_MODEL.md`.

---

## Getting Started

### Prerequisites
- Node.js 20 or later
- pnpm 9 or later
- Rust stable and the Stellar CLI
- A funded Stellar Testnet account (`stellar keys generate --fund`)
- Optional: vision model API key for `@pitchin/triage`

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

### Install
```bash
git clone https://github.com/your-org/pitchin.git
cd pitchin
pnpm install
cp .env.example .env     # add Stellar keys, storage config, optional model key
```

### Run in development
```bash
pnpm dev                                   # everything via Turborepo
pnpm --filter @pitchin/app dev             # app only
pnpm --filter @pitchin/api dev             # API only
pnpm --filter @pitchin/indexer start:testnet
```

### Test
```bash
cd packages/contracts && cargo test
pnpm turbo test
pnpm turbo lint
```

### Deploy contracts to Testnet
```bash
cd packages/contracts
stellar contract build
bash ../../scripts/deploy_testnet.sh
```

---

## Live on Testnet

| Contract | ID |
|---|---|
| IssueRegistry | *to be deployed* |
| RepairPool | *to be deployed* |
| ContractorRegistry | *to be deployed* |
| VerificationPanel | *to be deployed* |

---

## Roadmap

| Phase | Milestone |
|---|---|
| 1 | `IssueRegistry` and `RepairPool` on Testnet: report, pledge, refund, and a simple map app |
| 2 | `ContractorRegistry`, bid board, award flow, and staged payouts |
| 3 | `VerificationPanel`, neighbour quorum, and completion proof |
| 4 | Warranty holdback, Durability Score, and match pools for sponsors |
| 5 | Pitchin Triage (AI), offline reporting, first neighbourhood pilot, security audit, Mainnet launch |

---

## Planned Issues for Contributors

Pitchin is built to give contributors scoped, well-defined work every sprint.

| Type | Examples |
|---|---|
| **Smart contracts** | Tests for each invariant above, quorum edge cases, pro rata refund maths, retention and warranty timing, storage and fee optimisation |
| **Bug fixes** | Duplicate-merge false positives, map clustering at high zoom, pledge totals under concurrent updates |
| **New features** | Sponsor match dashboard, contractor bid comparison, area stats page, notification by email or SMS, offline report queue |
| **AI and vision** | Add labelled photos to the evaluation set, improve before/after comparison, new categories, blur accuracy for faces and plates |
| **Testing** | Indexer integration tests, end-to-end pledge-to-payout test on Testnet, fuzzing the verifier quorum logic |
| **Documentation** | Verification protocol, contractor onboarding guide, resident how-to, API reference |
| **Good first issues** | Typos, empty-state screens, map marker styles, README examples, new seed data |

Every issue has a description, acceptance criteria, and a pointer to the relevant files.

---

## Security

- Contract audit: pending, with reports to be published in `audits/`
- Photos are stored off-chain with only hashes on-chain, and faces and number plates are blurred before upload
- AI never holds keys and never releases funds
- Responsible disclosure: `security@your-domain.example`

---

## Contributing

```bash
git checkout -b feat/your-feature
pnpm turbo test
pnpm turbo lint
# open a PR against main
```
See `CONTRIBUTING.md`, `docs/architecture.md`, and `docs/SECURITY_MODEL.md`.

---

## License

MIT, 2026 Pitchin Contributors

---

*Built on Stellar. Powered by Soroban. Fix it together.*