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

## 🏭 Backend Architecture

### Agent Lifecycle Management

Both executor and verifier agents implement a robust state machine:

**States:**
- `INITIALIZING` - Validating configuration and establishing connections
- `IDLE` - Listening for events, ready to process
- `PROCESSING_TASK` / `VERIFYING_TASK` - Actively working on a task
- `ERROR` - Circuit breaker triggered, requires intervention
- `SHUTDOWN` - Graceful shutdown in progress

**State Transitions:**
```
INITIALIZING → IDLE → PROCESSING → IDLE
                ↓
              ERROR (after 5 consecutive RPC failures)
                ↓
            SHUTDOWN (on SIGINT/SIGTERM)
```

### Error Handling & Resilience

**Retry Logic:**
- Exponential backoff for transient RPC failures
- Configurable retry attempts (default: 3)
- Idempotent operations only

**Circuit Breaker:**
- Tracks consecutive RPC failures
- Enters ERROR state after threshold (default: 5)
- Prevents cascading failures

**Graceful Shutdown:**
- Handles SIGINT and SIGTERM signals
- Waits for current task to complete (max 5s)
- Clean exit with status logging

### Observability

**Structured Logging:**
- Timestamp on every log entry
- Agent type and address context
- Task ID tracking throughout lifecycle
- Clear success (✅) and failure (❌) markers
- Human-readable for demos, machine-parseable for production

**Log Levels:**
- `DEBUG` - State transitions, detailed execution
- `INFO` - Normal operations (default)
- `WARN` - Retries, low balance warnings
- `ERROR` - Transaction failures, configuration issues

### Demo Safety

**Demo Mode (`DEMO_MODE=true`):**
- Agents log all actions without sending transactions
- Shows expected behavior and payments
- Safe for repeated demo runs
- No gas costs or state changes

**Task Deduplication:**
- Agents track processed/verified tasks
- Prevents double-processing on restart
- Idempotent event handling

### Configuration Validation

**Startup Checks:**
1. Required environment variables present
2. Private keys valid format (32-byte hex)
3. RPC endpoint reachable
4. Contract deployed at specified address
5. Wallet has sufficient balance

**Fail-Fast Philosophy:**
- Clear error messages on misconfiguration
- No silent failures
- Actionable guidance for operators

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

## 🎬 Demo Checklist

### Pre-Demo Setup (5 minutes)

**1. Start Infrastructure:**
```bash
# Terminal 1: Start Hardhat node
npm run node

# Terminal 2: Deploy contract
npm run deploy:localhost
# Copy CONTRACT_ADDRESS to .env
```

**2. Verify Configuration:**
```bash
# Check .env has all required values:
# - RPC_URL=http://127.0.0.1:8545
# - CONTRACT_ADDRESS=0x... (from deployment)
# - EXECUTOR_PRIVATE_KEY=0x...
# - VERIFIER_PRIVATE_KEY=0x...
# - CREATOR_PRIVATE_KEY=0x...
```

**3. Start Agents:**
```bash
# Terminal 3: Start executor
npm run executor
# Wait for "Agent started successfully" message

# Terminal 4: Start verifier
npm run verifier
# Wait for "Agent started successfully" message
```

**4. Verify Agent Status:**
- Both agents should show state: `IDLE`
- Both should show "LISTENING" status
- Check wallet balances are > 0

### Running the Demo

**1. Create a Task:**
```bash
# Terminal 5: Create test task
npm run create-task
```

**2. Watch the Flow:**

Monitor logs in this order:

**Executor (Terminal 3):**
- ✅ "New task detected" with Task ID
- ✅ "Task accepted - escrow sufficient"
- ✅ "Accepting task" with bond amount
- ✅ "Task accepted" with transaction hash
- ✅ "Submitting result" with result hash
- ✅ "Result submitted" with transaction hash
- ✅ "Task processing complete"

**Verifier (Terminal 4):**
- ✅ "New result submitted" with Task ID
- ✅ "Verification started"
- ✅ "Verification decision made" (APPROVED/REJECTED)
- ✅ "Verification submitted" with transaction hash
- ✅ "Verification complete"

**3. Verify Completion:**
```bash
# Check final state (in Hardhat console or via script)
const task = await contract.getTask(0);
console.log('Status:', task.status); // Should be 4 (RESOLVED)
```

### Demo Mode (Safe Repeated Runs)

**Enable Demo Mode:**
```bash
# In .env
DEMO_MODE=true
```

**Benefits:**
- No real transactions sent
- No gas costs
- Logs show "DEMO MODE: Would accept task..."
- Safe for repeated presentations
- Shows expected behavior without state changes

**Reset for Live Demo:**
```bash
# In .env
DEMO_MODE=false

# Restart agents
# Ctrl+C in executor and verifier terminals
npm run executor
npm run verifier
```

### Troubleshooting During Demo

**Agents not responding:**
- Check state is `IDLE` (not `ERROR`)
- Verify RPC connection: `curl http://127.0.0.1:8545`
- Check agent wallet balances

**Transaction failures:**
- Check gas limits in logs
- Verify sufficient balance
- Look for revert reasons in error logs

**Circuit breaker triggered:**
- Agent entered `ERROR` state
- Restart agent after fixing RPC issues
- Check consecutive failure count in logs

## 📋 Operational Notes

### Normal Agent Behavior

**Startup Sequence:**
1. Validate configuration (env vars, RPC, contract)
2. Check wallet balance
3. Enter IDLE state
4. Start event listeners
5. Check for existing unprocessed tasks

**Task Processing:**
1. Detect event (TaskCreated or ResultSubmitted)
2. Transition to PROCESSING/VERIFYING state
3. Fetch task details from contract
4. Validate task status and parameters
5. Execute business logic
6. Submit transaction with retry logic
7. Wait for confirmation
8. Log success and return to IDLE

**Error Recovery:**
- Transient RPC failures: Automatic retry with exponential backoff
- Persistent failures: Enter ERROR state after 5 consecutive failures
- Configuration errors: Fail fast on startup with clear message

### Common Failure Modes

**1. RPC Connection Loss**
- **Symptom:** "Retry attempt X/3" in logs
- **Cause:** Network issues, Hardhat node stopped
- **Recovery:** Automatic retry, or restart Hardhat node

**2. Insufficient Balance**
- **Symptom:** "Insufficient balance" error
- **Cause:** Agent wallet ran out of ETH
- **Recovery:** Fund wallet, agent will resume on next task

**3. Circuit Breaker Triggered**
- **Symptom:** Agent state changes to ERROR
- **Cause:** 5+ consecutive RPC failures
- **Recovery:** Fix RPC issues, restart agent

**4. Configuration Errors**
- **Symptom:** Agent exits immediately on startup
- **Cause:** Missing/invalid env vars, wrong contract address
- **Recovery:** Fix .env file, restart agent

### Monitoring Best Practices

**What to Watch:**
- Agent state transitions (should cycle IDLE → PROCESSING → IDLE)
- Consecutive failure counts (should reset to 0 on success)
- Wallet balances (warn if < 0.1 ETH)
- Transaction confirmation times
- Verification verdicts (APPROVED vs REJECTED)

**Log Patterns:**
- ✅ Success markers indicate healthy operation
- ⚠️  Warnings indicate potential issues (low balance, retries)
- ❌ Errors require attention (transaction failures, config issues)

**Health Indicators:**
- State: IDLE (healthy) vs ERROR (needs intervention)
- Consecutive failures: 0 (healthy) vs 5+ (circuit breaker)
- Balance: > 0.1 ETH (healthy) vs < 0.01 ETH (critical)

### Production Deployment Considerations

**Before Production:**
1. Run full test suite: `npm test`
2. Check code coverage: `npx hardhat coverage`
3. Audit smart contract (external security review)
4. Test on testnet for 24+ hours
5. Set up monitoring and alerting
6. Prepare incident response plan

**Production Configuration:**
- Use hardware wallets or secure key management
- Set up RPC redundancy (multiple providers)
- Enable structured logging to centralized system
- Configure alerting for ERROR states
- Set appropriate retry limits and timeouts
- Monitor wallet balances and auto-refill

**Operational Runbook:**
- Agent restart procedure
- Wallet refill thresholds
- Circuit breaker reset process
- Emergency shutdown procedure
- Incident escalation path

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
