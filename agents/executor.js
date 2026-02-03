import { ethers } from 'ethers';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONTRACT_ABI = [
    "event TaskCreated(uint256 indexed taskId, address indexed creator, address indexed verifier, uint256 escrowAmount, bytes32 taskData)",
    "event TaskAccepted(uint256 indexed taskId, address indexed executor, uint256 bondAmount)",
    "event ResultSubmitted(uint256 indexed taskId, address indexed executor, bytes32 resultHash)",
    "function acceptTask(uint256 taskId) external payable",
    "function submitResult(uint256 taskId, bytes32 resultHash) external",
    "function getTask(uint256 taskId) external view returns (tuple(address creator, address executor, address verifier, uint256 escrowAmount, uint256 bondAmount, uint8 status, bytes32 taskData, bytes32 resultHash, uint8 verdict, uint256 createdAt, uint256 acceptedAt, uint256 submittedAt))",
    "function getTotalTasks() external view returns (uint256)"
];

// Agent lifecycle states
const AgentState = {
    INITIALIZING: 'INITIALIZING',
    IDLE: 'IDLE',
    PROCESSING_TASK: 'PROCESSING_TASK',
    ERROR: 'ERROR',
    SHUTDOWN: 'SHUTDOWN'
};

// Configuration with defaults
const CONFIG = {
    DEMO_MODE: process.env.DEMO_MODE === 'true',
    MIN_ESCROW_ETH: process.env.MIN_ESCROW_ETH || '0.01',
    RETRY_ATTEMPTS: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS || '1000'),
    TASK_PROCESSING_DELAY_MS: parseInt(process.env.TASK_PROCESSING_DELAY_MS || '2000'),
    LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', // DEBUG, INFO, WARN, ERROR
    CIRCUIT_BREAKER_THRESHOLD: 5, // Max consecutive RPC failures before entering ERROR state
};

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================

class Logger {
    constructor(agentType, agentAddress) {
        this.agentType = agentType;
        this.agentAddress = agentAddress;
    }

    _formatLog(level, action, context = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            agent: this.agentType,
            address: this.agentAddress,
            action,
            ...context
        };

        // Human-readable format for console
        const emoji = {
            DEBUG: '🔍',
            INFO: 'ℹ️ ',
            WARN: '⚠️ ',
            ERROR: '❌',
            SUCCESS: '✅'
        }[level] || 'ℹ️ ';

        let message = `${emoji} [${timestamp}] [${this.agentType}] ${action}`;

        if (context.taskId !== undefined) message += ` | Task: ${context.taskId}`;
        if (context.status) message += ` | Status: ${context.status}`;
        if (context.error) message += ` | Error: ${context.error}`;
        if (context.txHash) message += ` | Tx: ${context.txHash}`;

        return { logEntry, message };
    }

    debug(action, context) {
        if (CONFIG.LOG_LEVEL === 'DEBUG') {
            const { message } = this._formatLog('DEBUG', action, context);
            console.log(message);
        }
    }

    info(action, context) {
        const { message } = this._formatLog('INFO', action, context);
        console.log(message);
    }

    warn(action, context) {
        const { message } = this._formatLog('WARN', action, context);
        console.warn(message);
    }

    error(action, context) {
        const { message } = this._formatLog('ERROR', action, context);
        console.error(message);
    }

    success(action, context) {
        const { message } = this._formatLog('SUCCESS', action, context);
        console.log(message);
    }
}

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

async function retryWithBackoff(fn, context, maxAttempts = CONFIG.RETRY_ATTEMPTS) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === maxAttempts) {
                throw error;
            }

            const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            context.logger?.warn(`Retry attempt ${attempt}/${maxAttempts}`, {
                error: error.message,
                retryIn: `${delay}ms`
            });

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

// ============================================================================
// EXECUTOR AGENT
// ============================================================================

class ExecutorAgent {
    constructor() {
        this.state = AgentState.INITIALIZING;
        this.stateChangedAt = Date.now();
        this.currentTaskId = null;
        this.processedTasks = new Set(); // Prevent double-processing
        this.consecutiveRpcFailures = 0;
        this.isShuttingDown = false;

        // Initialize logger (address will be set after wallet creation)
        this.logger = new Logger('EXECUTOR', 'pending');

        this._setupShutdownHandlers();
    }

    _setupShutdownHandlers() {
        const shutdown = async (signal) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            this.logger.info(`Received ${signal}, shutting down gracefully...`, {
                currentState: this.state,
                currentTask: this.currentTaskId
            });

            this._setState(AgentState.SHUTDOWN);

            // Give current task a moment to complete
            if (this.currentTaskId !== null) {
                this.logger.warn('Task in progress, waiting 5s for completion...', {
                    taskId: this.currentTaskId
                });
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            this.logger.info('Shutdown complete', { status: 'CLEAN_EXIT' });
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }

    _setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.stateChangedAt = Date.now();

        this.logger.debug('State transition', {
            from: oldState,
            to: newState,
            currentTask: this.currentTaskId
        });
    }

    async _validateConfig() {
        this.logger.info('Validating configuration...');

        // Check required env vars
        const required = ['RPC_URL', 'CONTRACT_ADDRESS', 'EXECUTOR_PRIVATE_KEY'];
        const missing = required.filter(key => !process.env[key]);

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}\nPlease check your .env file.`);
        }

        // Validate private key format
        if (!process.env.EXECUTOR_PRIVATE_KEY.match(/^0x[0-9a-fA-F]{64}$/)) {
            throw new Error('EXECUTOR_PRIVATE_KEY must be a valid 32-byte hex string (0x...)');
        }

        // Initialize provider and wallet
        try {
            this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            this.wallet = new ethers.Wallet(process.env.EXECUTOR_PRIVATE_KEY, this.provider);
            this.contract = new ethers.Contract(
                process.env.CONTRACT_ADDRESS,
                CONTRACT_ABI,
                this.wallet
            );

            // Update logger with actual address
            this.logger = new Logger('EXECUTOR', this.wallet.address);

        } catch (error) {
            throw new Error(`Failed to initialize ethers: ${error.message}`);
        }

        // Test RPC connection
        try {
            await retryWithBackoff(
                async () => await this.provider.getBlockNumber(),
                { logger: this.logger }
            );
            this.logger.success('RPC connection verified', { rpc: process.env.RPC_URL });
        } catch (error) {
            throw new Error(`Cannot connect to RPC at ${process.env.RPC_URL}: ${error.message}`);
        }

        // Verify contract exists
        try {
            const code = await this.provider.getCode(process.env.CONTRACT_ADDRESS);
            if (code === '0x') {
                throw new Error(`No contract deployed at ${process.env.CONTRACT_ADDRESS}`);
            }
            this.logger.success('Contract verified', { address: process.env.CONTRACT_ADDRESS });
        } catch (error) {
            throw new Error(`Contract validation failed: ${error.message}`);
        }

        // Check wallet balance
        try {
            const balance = await this.provider.getBalance(this.wallet.address);
            this.logger.info('Wallet balance checked', {
                balance: ethers.formatEther(balance) + ' ETH'
            });

            if (balance === 0n) {
                throw new Error(`Executor wallet has zero balance. Please fund ${this.wallet.address}`);
            }

            // Warn if balance is low (< 0.1 ETH)
            if (balance < ethers.parseEther('0.1')) {
                this.logger.warn('Low wallet balance', {
                    balance: ethers.formatEther(balance) + ' ETH',
                    recommendation: 'Fund wallet for production use'
                });
            }
        } catch (error) {
            if (error.message.includes('zero balance')) throw error;
            throw new Error(`Balance check failed: ${error.message}`);
        }

        this.logger.success('Configuration validation complete');
    }

    _printStartupBanner() {
        console.log('\n' + '='.repeat(70));
        console.log('🤖 COVENANT EXECUTOR AGENT');
        console.log('='.repeat(70));
        console.log(`Address:      ${this.wallet.address}`);
        console.log(`Contract:     ${process.env.CONTRACT_ADDRESS}`);
        console.log(`RPC:          ${process.env.RPC_URL}`);
        console.log(`Demo Mode:    ${CONFIG.DEMO_MODE ? '✅ ENABLED (no real transactions)' : '❌ DISABLED (live transactions)'}`);
        console.log(`Min Escrow:   ${CONFIG.MIN_ESCROW_ETH} ETH`);
        console.log(`Retry Limit:  ${CONFIG.RETRY_ATTEMPTS} attempts`);
        console.log(`Log Level:    ${CONFIG.LOG_LEVEL}`);
        console.log('='.repeat(70) + '\n');
    }

    /**
     * Execute the deterministic task: compute SHA256 hash
     */
    executeTask(taskData) {
        const taskInput = taskData.slice(2);
        const hash = crypto.createHash('sha256').update(taskInput, 'hex').digest();
        const resultHash = '0x' + hash.toString('hex');

        this.logger.debug('Task executed', {
            taskId: this.currentTaskId,
            input: taskData,
            result: resultHash
        });

        return resultHash;
    }

    /**
     * Evaluate if a task is worth accepting
     */
    shouldAcceptTask(task) {
        const minEscrow = ethers.parseEther(CONFIG.MIN_ESCROW_ETH);

        if (task.escrowAmount < minEscrow) {
            this.logger.info('Task rejected - escrow too low', {
                taskId: this.currentTaskId,
                escrow: ethers.formatEther(task.escrowAmount) + ' ETH',
                minimum: CONFIG.MIN_ESCROW_ETH + ' ETH'
            });
            return false;
        }

        this.logger.info('Task accepted - escrow sufficient', {
            taskId: this.currentTaskId,
            escrow: ethers.formatEther(task.escrowAmount) + ' ETH'
        });
        return true;
    }

    /**
     * Accept a task and post bond
     */
    async acceptTask(taskId, escrowAmount) {
        try {
            const bondAmount = escrowAmount / 100n;

            this.logger.info('Accepting task', {
                taskId,
                bond: ethers.formatEther(bondAmount) + ' ETH'
            });

            if (CONFIG.DEMO_MODE) {
                this.logger.warn('DEMO MODE: Would accept task (skipping transaction)', {
                    taskId,
                    bond: ethers.formatEther(bondAmount) + ' ETH'
                });
                return true;
            }

            // Check balance before transaction
            const balance = await this.provider.getBalance(this.wallet.address);
            if (balance < bondAmount) {
                throw new Error(`Insufficient balance: have ${ethers.formatEther(balance)} ETH, need ${ethers.formatEther(bondAmount)} ETH`);
            }

            const tx = await retryWithBackoff(
                async () => await this.contract.acceptTask(taskId, { value: bondAmount }),
                { logger: this.logger }
            );

            this.logger.debug('Transaction sent', { taskId, txHash: tx.hash });

            const receipt = await tx.wait();

            this.logger.success('Task accepted', {
                taskId,
                txHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString()
            });

            this.consecutiveRpcFailures = 0; // Reset on success
            return true;

        } catch (error) {
            this._handleTransactionError('acceptTask', taskId, error);
            return false;
        }
    }

    /**
     * Submit task result
     */
    async submitResult(taskId, resultHash) {
        try {
            this.logger.info('Submitting result', {
                taskId,
                resultHash
            });

            if (CONFIG.DEMO_MODE) {
                this.logger.warn('DEMO MODE: Would submit result (skipping transaction)', {
                    taskId,
                    resultHash
                });
                return true;
            }

            const tx = await retryWithBackoff(
                async () => await this.contract.submitResult(taskId, resultHash),
                { logger: this.logger }
            );

            this.logger.debug('Transaction sent', { taskId, txHash: tx.hash });

            const receipt = await tx.wait();

            this.logger.success('Result submitted', {
                taskId,
                txHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString()
            });

            this.consecutiveRpcFailures = 0; // Reset on success
            return true;

        } catch (error) {
            this._handleTransactionError('submitResult', taskId, error);
            return false;
        }
    }

    _handleTransactionError(action, taskId, error) {
        this.consecutiveRpcFailures++;

        // Extract revert reason if available
        let errorMessage = error.message;
        if (error.reason) {
            errorMessage = error.reason;
        } else if (error.data) {
            errorMessage += ` (data: ${error.data})`;
        }

        this.logger.error(`Transaction failed: ${action}`, {
            taskId,
            error: errorMessage,
            consecutiveFailures: this.consecutiveRpcFailures
        });

        // Circuit breaker: enter ERROR state if too many consecutive failures
        if (this.consecutiveRpcFailures >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
            this.logger.error('Circuit breaker triggered - too many consecutive RPC failures', {
                threshold: CONFIG.CIRCUIT_BREAKER_THRESHOLD,
                status: 'ENTERING_ERROR_STATE'
            });
            this._setState(AgentState.ERROR);
        }
    }

    /**
     * Process a new task
     */
    async processTask(taskId) {
        // Prevent double-processing
        if (this.processedTasks.has(taskId.toString())) {
            this.logger.debug('Task already processed, skipping', { taskId: taskId.toString() });
            return;
        }

        // Don't process if in ERROR or SHUTDOWN state
        if (this.state === AgentState.ERROR || this.state === AgentState.SHUTDOWN) {
            this.logger.warn('Agent not in operational state, skipping task', {
                taskId: taskId.toString(),
                currentState: this.state
            });
            return;
        }

        this._setState(AgentState.PROCESSING_TASK);
        this.currentTaskId = taskId.toString();

        try {
            this.logger.info('Processing task started', { taskId: this.currentTaskId });

            // Get task details
            const task = await retryWithBackoff(
                async () => await this.contract.getTask(taskId),
                { logger: this.logger }
            );

            // Check if task is in Created status (0)
            if (task.status !== 0) {
                this.logger.info('Task not in Created status, skipping', {
                    taskId: this.currentTaskId,
                    status: task.status
                });
                this.processedTasks.add(this.currentTaskId);
                return;
            }

            // Evaluate task
            if (!this.shouldAcceptTask(task)) {
                this.processedTasks.add(this.currentTaskId);
                return;
            }

            // Accept task
            const accepted = await this.acceptTask(taskId, task.escrowAmount);
            if (!accepted) {
                this.processedTasks.add(this.currentTaskId);
                return;
            }

            // Wait for confirmation
            await new Promise(resolve => setTimeout(resolve, CONFIG.TASK_PROCESSING_DELAY_MS));

            // Execute task
            const resultHash = this.executeTask(task.taskData);

            // Submit result
            const submitted = await this.submitResult(taskId, resultHash);

            if (submitted) {
                this.processedTasks.add(this.currentTaskId);
                this.logger.success('Task processing complete', { taskId: this.currentTaskId });
            }

        } catch (error) {
            this.logger.error('Task processing failed', {
                taskId: this.currentTaskId,
                error: error.message
            });
        } finally {
            this.currentTaskId = null;
            this._setState(AgentState.IDLE);
        }
    }

    /**
     * Listen for new tasks
     */
    async listenForTasks() {
        this.logger.info('Starting event listener for new tasks');

        // Wrap event listener in try-catch to prevent crashes
        this.contract.on('TaskCreated', async (taskId, creator, verifier, escrowAmount, taskData) => {
            try {
                this.logger.info('New task detected', {
                    taskId: taskId.toString(),
                    creator,
                    escrow: ethers.formatEther(escrowAmount) + ' ETH'
                });

                await this.processTask(taskId);
            } catch (error) {
                this.logger.error('Error in event handler', {
                    taskId: taskId.toString(),
                    error: error.message
                });
            }
        });

        // Check for existing unprocessed tasks
        await this.checkExistingTasks();
    }

    /**
     * Check for existing tasks that haven't been accepted
     */
    async checkExistingTasks() {
        try {
            const totalTasks = await retryWithBackoff(
                async () => await this.contract.getTotalTasks(),
                { logger: this.logger }
            );

            this.logger.info('Checking existing tasks', { total: totalTasks.toString() });

            for (let i = 0; i < totalTasks; i++) {
                if (this.isShuttingDown) break;

                const task = await this.contract.getTask(i);

                if (task.status === 0) {
                    await this.processTask(i);
                }
            }
        } catch (error) {
            this.logger.error('Error checking existing tasks', { error: error.message });
        }
    }

    /**
     * Start the agent
     */
    async start() {
        try {
            await this._validateConfig();
            this._printStartupBanner();

            this._setState(AgentState.IDLE);
            await this.listenForTasks();

            this.logger.success('Agent started successfully', { status: 'LISTENING' });

        } catch (error) {
            this.logger.error('Fatal startup error', { error: error.message });
            this._setState(AgentState.ERROR);
            process.exit(1);
        }
    }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    const agent = new ExecutorAgent();
    await agent.start();
}

main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});
