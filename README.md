# COVENANT

**Onchain Escrow + Verification System for Autonomous Agents**

A minimal, production-quality MVP that demonstrates autonomous agents executing tasks with economic staking, independent verification, and persistent onchain reputation.

## 🎯 Core Concept

COVENANT enables trustless task execution by autonomous agents with real economic consequences:

- **Executor Agent**: Accepts tasks, posts bond, executes work, submits results
- **Verifier Agent**: Independently verifies results, approves or rejects
- **Smart Contract**: Manages escrow, enforces rules, tracks reputation

## 🏗️ Architecture

### Smart Contract: `CovenantEscrow.sol`

**State Machine:**
```
CREATED → ACCEPTED → SUBMITTED → VERIFIED → RESOLVED
```

**Economic Parameters:**
- Minimum bond: 1% of escrow
- Task timeout: 1 hour
- Verification timeout: 30 minutes
- Verifier fee: 5% of escrow
- Reputation: +10 for success, -20 for failure

**Key Functions:**
- `createTask()` - Creator escrows funds
- `acceptTask()` - Executor posts bond
- `submitResult()` - Executor submits work
- `verifyResult()` - Verifier checks work
- `resolveTask()` - Final settlement

### Agents

**Executor Agent** (`agents/executor.js`)
- Monitors for new tasks via events
- Evaluates escrow amounts
- Posts bond and accepts tasks
- Executes SHA256 hash computation
- Submits results

**Verifier Agent** (`agents/verifier.js`)
- Monitors for submitted results
- Re-executes computation independently
- Compares result hashes
- Submits verification verdict
- Receives fee for verification work

### Task Type (MVP)

**Deterministic Hash Computation:**
- Input: 32-byte hex string
- Computation: SHA256 hash
- Output: 32-byte hash
- Verification: Re-compute and compare

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Local Testing (Full Flow)

#### Terminal 1: Start Local Blockchain

```bash
npm run node
```

This starts a local Hardhat node with test accounts.

#### Terminal 2: Deploy Contract

```bash
# Deploy to local network
npm run deploy:localhost
```

Copy the deployed contract address and update `.env`:

```env
CONTRACT_ADDRESS=0x... # Paste deployed address
```

#### Terminal 3: Setup Test Wallets

Use the private keys from the Hardhat node output (Terminal 1) and add to `.env`:

```env
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x... # From deployment

# Use different accounts from Hardhat node
CREATOR_PRIVATE_KEY=0x...  # Account #0
EXECUTOR_PRIVATE_KEY=0x... # Account #1
VERIFIER_PRIVATE_KEY=0x... # Account #2
```

#### Terminal 4: Start Executor Agent

```bash
npm run executor
```

The executor will listen for new tasks and automatically process them.

#### Terminal 5: Start Verifier Agent

```bash
npm run verifier
```

The verifier will listen for submitted results and verify them.

#### Terminal 6: Create a Test Task

```bash
npm run create-task
```

This creates a task with:
- Random 32-byte input data
- 0.1 ETH escrow
- Designated verifier

**Watch the magic happen:**
1. Executor detects the task
2. Executor accepts and posts bond
3. Executor computes SHA256 hash
4. Executor submits result
5. Verifier detects submission
6. Verifier re-computes hash independently
7. Verifier approves/rejects result
8. Contract resolves and pays out
9. Reputation updated

## 🧪 Testing

### Run Unit Tests

```bash
npm test
```

Tests cover:
- Task creation with escrow
- Task acceptance with bonding
- Result submission
- Verification (valid and invalid)
- Resolution and fund distribution
- Reputation tracking
- Timeout scenarios
- Edge cases

### Test Coverage

```bash
npx hardhat coverage
```

## 📁 Project Structure

```
COVENANT/
├── contracts/
│   └── CovenantEscrow.sol      # Main escrow contract
├── agents/
│   ├── executor.js             # Executor agent
│   └── verifier.js             # Verifier agent
├── scripts/
│   ├── deploy.js               # Deployment script
│   └── createTask.js           # Test task creation
├── test/
│   └── CovenantEscrow.test.js  # Contract tests
├── hardhat.config.ts           # Hardhat configuration
├── package.json                # Dependencies and scripts
└── .env.example                # Environment template
```

## 🔐 Security Considerations

### Smart Contract

- ✅ Reentrancy guards on all fund transfers
- ✅ State validation at each step
- ✅ Timeout mechanisms for stuck tasks
- ✅ Custom errors for gas efficiency
- ✅ Events for all state transitions

### Agents

- ✅ Private key management via environment variables
- ✅ Balance checks before operations
- ✅ Transaction confirmation waiting
- ✅ Error handling and logging

### Production Deployment

**DO NOT:**
- Commit private keys to git
- Use test keys in production
- Deploy without audit for real funds

**DO:**
- Use hardware wallets for production
- Implement key rotation
- Monitor agent balances
- Set up alerting for failures

## 🌐 Deploying to Monad

### Update Configuration

1. Get Monad RPC URL
2. Update `hardhat.config.ts`:

```typescript
monad: {
  url: process.env.MONAD_RPC_URL,
  accounts: [process.env.DEPLOYER_PRIVATE_KEY],
}
```

3. Update `.env`:

```env
MONAD_RPC_URL=https://...
RPC_URL=https://...  # Same as MONAD_RPC_URL for agents
```

### Deploy

```bash
npx hardhat run scripts/deploy.js --network monad
```

### Fund Agent Wallets

Send ETH/MON to:
- Executor wallet (for gas + bonds)
- Verifier wallet (for gas)

### Start Agents

```bash
# In separate terminals
npm run executor
npm run verifier
```

## 📊 Monitoring

### Check Task Status

```javascript
const task = await contract.getTask(taskId);
console.log('Status:', ['Created', 'Accepted', 'Submitted', 'Verified', 'Resolved'][task.status]);
```

### Check Reputation

```javascript
const reputation = await contract.getReputation(agentAddress);
console.log('Reputation:', reputation.toString());
```

### View Events

```bash
# In Hardhat console
npx hardhat console --network localhost

const contract = await ethers.getContractAt("CovenantEscrow", "0x...");
const events = await contract.queryFilter("TaskCreated");
console.log(events);
```

## 🛠️ Development

### Compile Contracts

```bash
npm run compile
```

### Clean Build

```bash
npx hardhat clean
npm run compile
```

### Console

```bash
npx hardhat console --network localhost
```

## 📈 Future Enhancements

**Beyond MVP:**
- Multiple task types
- Configurable economic parameters
- Multi-round dispute resolution
- Agent reputation-based bonding
- Task marketplace
- Batch task processing
- Cross-chain support

## 🐛 Troubleshooting

### Agents Not Processing Tasks

1. Check RPC connection: `curl http://127.0.0.1:8545`
2. Verify contract address in `.env`
3. Check agent wallet balances
4. Review agent logs for errors

### Transaction Failures

1. Check gas limits
2. Verify account has sufficient balance
3. Ensure correct task status
4. Check bond amount (must be ≥1% of escrow)

### Tests Failing

1. Clean build: `npx hardhat clean`
2. Recompile: `npm run compile`
3. Check Hardhat version compatibility
4. Review test output for specific errors

## 📝 License

MIT

## 🤝 Contributing

This is a hackathon MVP. Contributions welcome for:
- Additional task types
- Security improvements
- Gas optimizations
- Documentation
- Test coverage

## ⚠️ Disclaimer

This is experimental software. Use at your own risk. Not audited. Not for production use with real funds without proper security review.

---

**Built for hackathon MVP - Simple, Readable, Functional**
