# 🧞 MezoGenie — Your Bitcoin Bank in iMessage

> *"2 billion people use iMessage every day. Zero of them can bank on Bitcoin from it. MezoGenie changes that."*

MezoGenie is a conversational AI-powered Bitcoin bank delivered through iMessage. Users text a phone number and get access to Bitcoin-backed borrowing, remittances, panic protection, and yield — all without downloading an app, installing a wallet, or understanding DeFi.

Built on [Mezo](https://mezo.org) for the **Encode Club × Mezo Hackathon: Building Bitcoin's Future**.

**Track:** Supernormal dApps (MUSD) + Bank on Bitcoin

---

## 🎯 The Problem

- **$800B+** flows through remittances annually — Western Union charges 6-8% in fees
- **47% of BTC holders** are currently at a loss and panic-selling at the worst time
- **DeFi is unusable** for normal people — complex UIs, wallet setup, gas management
- Bitcoin holders want to **spend without selling** but have no simple way to do it

## 💡 The Solution

MezoGenie combines four financial products into one iMessage conversation:

### 📤 Remittances (MezoRemit)
Send money home for ~0% fees. BTC collateral → mint MUSD → send to recipient via iMessage. Yield auto-repays the debt. Every remittance builds a **Family Savings Vault** in Bitcoin.

### 🛡️ Panic Protection (MezoSafe)
Time-lock your BTC to prevent emotional selling. If you need cash urgently, mint MUSD against your locked BTC instead of selling. Optional 72-hour cooling-off period during market crashes.

### 💰 Borrow & Spend (Buy Now, Pay Never)
Lock BTC as collateral, mint MUSD, spend it. Your BTC earns yield that auto-repays the debt over time. Net cost: $0.

### 🤖 AI Financial Advisor
Natural language interface powered by GPT-4o with function calling. Ask anything:
- *"Send $500 to my mom"*
- *"BTC is crashing, am I safe?"*
- *"Lock my BTC for 6 months"*
- *"What's my balance?"*

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     USER'S iPHONE                        │
│                    (just iMessage)                        │
└─────────────────────┬────────────────────────────────────┘
                      │ iMessage (blue bubble)
                      ▼
┌──────────────────────────────────────────────────────────┐
│                   SENDBLUE API                            │
│  Send/receive iMessage, typing indicators, tapbacks       │
│  Fallback: SMS/RCS for Android                            │
└─────────────────────┬────────────────────────────────────┘
                      │ Webhook POST
                      ▼
┌──────────────────────────────────────────────────────────┐
│                 BACKEND (Node.js)                         │
│                                                           │
│  Sendblue Handler → AI Agent (Groq/Llama) → Chain Service    │
│                     6 tools via          (viem + Mezo)    │
│                     function calling                      │
│                                                           │
│  SQLite DB: phone→wallet mapping, alerts, recipients      │
└─────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│               MEZO TESTNET (Chain 31611)                  │
│                                                           │
│  Mezo Core:          MezoGenie Contracts:                 │
│  BorrowerOperations  RemitVault.sol (remit + family vault)│
│  TroveManager        SafeVault.sol (panic protection)     │
│  MUSD (ERC20)                                             │
│  Pyth Oracle                                              │
└──────────────────────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
mezogenie/
├── contracts/                  # Solidity smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── RemitVault.sol      # Remittance + family vault + BNPL
│   │   ├── SafeVault.sol       # Panic protection + time-lock
│   │   ├── interfaces/         # Mezo core contract interfaces
│   │   └── mocks/              # Mock contracts for testing
│   ├── test/                   # 11 passing tests
│   ├── scripts/deploy.ts       # Deployment script
│   └── deployments.json        # Deployed addresses
│
├── backend/                    # Express + AI Agent + Sendblue
│   └── src/
│       ├── index.ts            # Express server + webhook handler
│       └── services/
│           ├── agent.ts        # GPT-4o with 6 function-calling tools
│           ├── chain.ts        # viem client for Mezo testnet
│           ├── db.ts           # SQLite for user/recipient state
│           └── sendblue.ts     # iMessage send/receive/typing
│
├── web/                        # Next.js wallet connect page
│   └── src/app/
│       ├── page.tsx            # One-time wallet linking via Mezo Passport
│       ├── providers.tsx       # RainbowKit + wagmi config
│       └── layout.tsx
│
└── .env                        # All config (not committed)
```

---

## 🔗 Deployed Contracts (Mezo Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| **RemitVault** | `0xaAeF80Bc871c3BA27de8aD68F72c8471C36321C3` | [View](https://explorer.test.mezo.org/address/0xaAeF80Bc871c3BA27de8aD68F72c8471C36321C3) |
| **SafeVault** | `0xe53CF92a14eA8456CC7A0a36435e38335bb0E07b` | [View](https://explorer.test.mezo.org/address/0xe53CF92a14eA8456CC7A0a36435e38335bb0E07b) |

### Mezo Core Contracts Used

| Contract | Address |
|----------|---------|
| BorrowerOperations | `0x20fAeA18B6a1D0FCDBCcFfFe3d164314744baF30` |
| TroveManager | `0xD374631405613990d62984a08663A28248678975` |
| SortedTroves | `0xD54700Ad42fc49A829DCD3C377aD7B9ed176656A` |
| HintHelpers | `0x8adF3f35dBE4026112bCFc078872bcb967732Ea8` |
| MUSD Token | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Messaging | [Sendblue API v2](https://docs.sendblue.com) | iMessage send/receive, typing indicators, tapbacks, SMS/RCS fallback |
| AI | [Groq](https://groq.com) (Llama 3.3 70B) | Natural language understanding + function calling for on-chain actions — free & fast |
| Smart Contracts | Solidity 0.8.28 + Hardhat | RemitVault, SafeVault — deployed on Mezo testnet |
| Backend | Node.js + Express + TypeScript | Webhook handler, AI orchestration, chain interactions |
| Chain | [viem](https://viem.sh) | Mezo testnet reads/writes via Boar Network RPC |
| Database | SQLite | Phone→wallet mapping, recipient tracking, alert preferences |
| Frontend | Next.js + [Mezo Passport](https://www.npmjs.com/package/@mezo-org/passport) | One-time wallet connect page |
| Oracle | [Pyth Network](https://pyth.network) | BTC/USD price feed on Mezo testnet |
| RPC | [Boar Network](https://boar.network) | Primary RPC provider for Mezo |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm
- [Sendblue account](https://dashboard.sendblue.com/company-signup) (free for 10 contacts)
- [Groq API key](https://console.groq.com) (free)
- Testnet BTC from [Mezo Faucet](https://faucet.test.mezo.org)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/mezogenie.git
cd mezogenie

# Install all workspaces
cd contracts && npm install && cd ..
cd backend && npm install && cd ..
cd web && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in your keys:
# - SENDBLUE_API_KEY / SENDBLUE_API_SECRET
# - GROQ_API_KEY (free from console.groq.com)
# - DEPLOYER_PRIVATE_KEY (funded with testnet BTC)
```

### 3. Run Tests

```bash
cd contracts && npx hardhat test
# 11 passing tests
```

### 4. Deploy Contracts (already deployed — skip if using existing)

```bash
cd contracts && npm run deploy
```

### 5. Start Backend

```bash
cd backend && npm run dev
# 🧞 MezoGenie backend running on port 3000
```

### 6. Expose Webhook (for Sendblue)

```bash
ngrok http 3000
# Set webhook URL in Sendblue dashboard: https://your-ngrok-url/webhook/sendblue
```

### 7. Start Web App

```bash
cd web && npm run dev
# Wallet connect page on http://localhost:3001
```

### 8. Text Your Bot!

Send an iMessage to your Sendblue phone number. MezoGenie will respond.

---

## 🧪 AI Agent Tools

The AI agent uses OpenAI function calling with 6 tools:

| Tool | Description |
|------|-------------|
| `check_balance` | Read user's BTC balance on Mezo |
| `send_remittance` | Lock BTC → mint MUSD → send to recipient + family vault |
| `check_pending_claims` | Check if user has MUSD to claim (as recipient) |
| `check_family_vault` | View family savings balance |
| `lock_btc` | Lock BTC in SafeVault with time-lock + cooling-off |
| `check_safe_vault` | View SafeVault lock status |

---

## 📊 Mezo Integration Depth

MezoGenie deeply integrates with the Mezo protocol:

- **MUSD Minting**: Every remittance opens/adjusts a Trove via `BorrowerOperations.openTrove()` to mint MUSD against BTC collateral
- **MUSD Transfers**: Recipients receive MUSD — the native Bitcoin-backed stablecoin
- **MUSD as Savings**: Family Vault accumulates MUSD for long-term wealth building
- **Trove Management**: AI agent reads collateral ratios, debt, and position health via `TroveManager`
- **Price Oracle**: Pyth Network integration for real-time BTC/USD pricing
- **Hint System**: Uses `HintHelpers` + `SortedTroves` for gas-efficient trove insertion

---

## 💼 Business Viability

| Metric | Value |
|--------|-------|
| Remittance TAM | $800B+ annually |
| Current fees (Western Union) | 6-8% ($50B+ extracted from the poorest) |
| MezoGenie fees | ~0% (yield covers costs) |
| Revenue model | Small protocol fee (0.1-0.5%) per remittance, premium alerts subscription |
| Target users | 280M+ migrant workers worldwide |

---

## 🏆 Why This Wins

| Criteria (Weight) | Score |
|---|---|
| **Mezo Integration (30%)** | Opens Troves, mints MUSD, transfers MUSD, reads positions, uses Pyth oracle — touches every core Mezo component |
| **Business Viability (30%)** | $800B remittance market + BNPL ($576B) + panic protection. Clear revenue model |
| **Technical (20%)** | Smart contracts + AI agent + Sendblue + oracle + wallet management — 4 distinct systems |
| **UX (10%)** | Maximum score — the interface is iMessage. Zero learning curve |
| **Presentation (10%)** | Demo by texting a phone number on stage. Audience watches the conversation live |

---

## 🔮 Roadmap (Post-Hackathon)

- [ ] Account abstraction (ERC-4337) for recipient self-custody
- [ ] P2P escrow for MUSD → local currency off-ramp
- [ ] Off-ramp partner integrations (Yellow Card, Coins.ph, Bitso)
- [ ] Proactive alerts: collateral health monitoring + weekly digests
- [ ] Group family vaults with multi-sig governance
- [ ] Mainnet deployment with Boar Network RPC

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- [Mezo](https://mezo.org) — Bitcoin-native DeFi infrastructure
- [Sendblue](https://sendblue.com) — iMessage API
- [Boar Network](https://boar.network) — RPC infrastructure
- [Encode Club](https://encode.club) — Hackathon organization
- [Groq](https://groq.com) — Llama 3.3 70B inference for the AI agent
