import { ethers } from 'ethers';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Contract ABI (only the functions we need)
const CONTRACT_ABI = [
    "event TaskCreated(uint256 indexed taskId, address indexed creator, address indexed verifier, uint256 escrowAmount, bytes32 taskData)",
    "event TaskAccepted(uint256 indexed taskId, address indexed executor, uint256 bondAmount)",
    "event ResultSubmitted(uint256 indexed taskId, address indexed executor, bytes32 resultHash)",
    "function acceptTask(uint256 taskId) external payable",
    "function submitResult(uint256 taskId, bytes32 resultHash) external",
    "function getTask(uint256 taskId) external view returns (tuple(address creator, address executor, address verifier, uint256 escrowAmount, uint256 bondAmount, uint8 status, bytes32 taskData, bytes32 resultHash, uint8 verdict, uint256 createdAt, uint256 acceptedAt, uint256 submittedAt))",
    "function getTotalTasks() external view returns (uint256)"
];

class ExecutorAgent {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.wallet = new ethers.Wallet(process.env.EXECUTOR_PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(
            process.env.CONTRACT_ADDRESS,
            CONTRACT_ABI,
            this.wallet
        );

        console.log('🤖 Executor Agent initialized');
        console.log('📍 Address:', this.wallet.address);
        console.log('📜 Contract:', process.env.CONTRACT_ADDRESS);
    }

    /**
     * Execute the deterministic task: compute SHA256 hash
     */
    executeTask(taskData) {
        // Convert bytes32 to string (remove 0x prefix)
        const taskInput = taskData.slice(2);

        // Compute SHA256 hash
        const hash = crypto.createHash('sha256').update(taskInput, 'hex').digest();

        // Convert to bytes32 format
        const resultHash = '0x' + hash.toString('hex');

        console.log('  📊 Task Input:', taskData);
        console.log('  ✅ Computed Result:', resultHash);

        return resultHash;
    }

    /**
     * Evaluate if a task is worth accepting
     */
    shouldAcceptTask(task) {
        const minEscrow = ethers.parseEther('0.01'); // Minimum 0.01 ETH

        if (task.escrowAmount < minEscrow) {
            console.log('  ❌ Escrow too low:', ethers.formatEther(task.escrowAmount), 'ETH');
            return false;
        }

        console.log('  ✅ Task acceptable - Escrow:', ethers.formatEther(task.escrowAmount), 'ETH');
        return true;
    }

    /**
     * Accept a task and post bond
     */
    async acceptTask(taskId, escrowAmount) {
        try {
            // Calculate bond (1% of escrow)
            const bondAmount = escrowAmount / 100n;

            console.log(`\n💼 Accepting task ${taskId}...`);
            console.log('  💰 Bond amount:', ethers.formatEther(bondAmount), 'ETH');

            const tx = await this.contract.acceptTask(taskId, { value: bondAmount });
            console.log('  📤 Transaction sent:', tx.hash);

            const receipt = await tx.wait();
            console.log('  ✅ Task accepted! Gas used:', receipt.gasUsed.toString());

            return true;
        } catch (error) {
            console.error('  ❌ Error accepting task:', error.message);
            return false;
        }
    }

    /**
     * Submit task result
     */
    async submitResult(taskId, resultHash) {
        try {
            console.log(`\n📝 Submitting result for task ${taskId}...`);
            console.log('  🔐 Result hash:', resultHash);

            const tx = await this.contract.submitResult(taskId, resultHash);
            console.log('  📤 Transaction sent:', tx.hash);

            const receipt = await tx.wait();
            console.log('  ✅ Result submitted! Gas used:', receipt.gasUsed.toString());

            return true;
        } catch (error) {
            console.error('  ❌ Error submitting result:', error.message);
            return false;
        }
    }

    /**
     * Process a new task
     */
    async processTask(taskId) {
        try {
            console.log(`\n🔍 Processing task ${taskId}...`);

            // Get task details
            const task = await this.contract.getTask(taskId);

            // Check if task is in Created status (0)
            if (task.status !== 0) {
                console.log('  ⏭️  Task not in Created status, skipping');
                return;
            }

            // Evaluate task
            if (!this.shouldAcceptTask(task)) {
                return;
            }

            // Accept task
            const accepted = await this.acceptTask(taskId, task.escrowAmount);
            if (!accepted) {
                return;
            }

            // Wait a bit for confirmation
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Execute task
            const resultHash = this.executeTask(task.taskData);

            // Submit result
            await this.submitResult(taskId, resultHash);

        } catch (error) {
            console.error('❌ Error processing task:', error.message);
        }
    }

    /**
     * Listen for new tasks
     */
    async listenForTasks() {
        console.log('\n👂 Listening for new tasks...\n');

        // Listen for TaskCreated events
        this.contract.on('TaskCreated', async (taskId, creator, verifier, escrowAmount, taskData) => {
            console.log('\n🔔 New task detected!');
            console.log('  Task ID:', taskId.toString());
            console.log('  Creator:', creator);
            console.log('  Escrow:', ethers.formatEther(escrowAmount), 'ETH');

            // Process the task
            await this.processTask(taskId);
        });

        // Also check for any existing unprocessed tasks
        await this.checkExistingTasks();
    }

    /**
     * Check for existing tasks that haven't been accepted
     */
    async checkExistingTasks() {
        try {
            const totalTasks = await this.contract.getTotalTasks();
            console.log(`📋 Checking ${totalTasks} existing tasks...\n`);

            for (let i = 0; i < totalTasks; i++) {
                const task = await this.contract.getTask(i);

                // Process if task is in Created status (0)
                if (task.status === 0) {
                    await this.processTask(i);
                }
            }
        } catch (error) {
            console.error('❌ Error checking existing tasks:', error.message);
        }
    }

    /**
     * Start the agent
     */
    async start() {
        try {
            // Check balance
            const balance = await this.provider.getBalance(this.wallet.address);
            console.log('💰 Balance:', ethers.formatEther(balance), 'ETH\n');

            if (balance === 0n) {
                console.error('❌ Insufficient balance! Please fund the executor wallet.');
                process.exit(1);
            }

            // Start listening
            await this.listenForTasks();

        } catch (error) {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        }
    }
}

// Main execution
async function main() {
    if (!process.env.RPC_URL || !process.env.CONTRACT_ADDRESS || !process.env.EXECUTOR_PRIVATE_KEY) {
        console.error('❌ Missing required environment variables!');
        console.error('Please set: RPC_URL, CONTRACT_ADDRESS, EXECUTOR_PRIVATE_KEY');
        process.exit(1);
    }

    const agent = new ExecutorAgent();
    await agent.start();
}

main().catch(console.error);
