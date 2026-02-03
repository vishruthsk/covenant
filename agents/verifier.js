import { ethers } from 'ethers';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Contract ABI (only the functions we need)
const CONTRACT_ABI = [
    "event ResultSubmitted(uint256 indexed taskId, address indexed executor, bytes32 resultHash)",
    "event ResultVerified(uint256 indexed taskId, address indexed verifier, bool isValid)",
    "function verifyResult(uint256 taskId, bool isValid) external",
    "function getTask(uint256 taskId) external view returns (tuple(address creator, address executor, address verifier, uint256 escrowAmount, uint256 bondAmount, uint8 status, bytes32 taskData, bytes32 resultHash, uint8 verdict, uint256 createdAt, uint256 acceptedAt, uint256 submittedAt))",
    "function getTotalTasks() external view returns (uint256)"
];

class VerifierAgent {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.wallet = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(
            process.env.CONTRACT_ADDRESS,
            CONTRACT_ABI,
            this.wallet
        );

        console.log('🔍 Verifier Agent initialized');
        console.log('📍 Address:', this.wallet.address);
        console.log('📜 Contract:', process.env.CONTRACT_ADDRESS);
    }

    /**
     * Independently execute the task to verify result
     */
    executeTaskIndependently(taskData) {
        // Convert bytes32 to string (remove 0x prefix)
        const taskInput = taskData.slice(2);

        // Compute SHA256 hash independently
        const hash = crypto.createHash('sha256').update(taskInput, 'hex').digest();

        // Convert to bytes32 format
        const expectedHash = '0x' + hash.toString('hex');

        console.log('  📊 Task Input:', taskData);
        console.log('  🔐 Expected Result:', expectedHash);

        return expectedHash;
    }

    /**
     * Verify a submitted result
     */
    async verifyTask(taskId) {
        try {
            console.log(`\n🔍 Verifying task ${taskId}...`);

            // Get task details
            const task = await this.contract.getTask(taskId);

            // Check if task is in Submitted status (2)
            if (task.status !== 2) {
                console.log('  ⏭️  Task not in Submitted status, skipping');
                return;
            }

            // Check if we are the assigned verifier
            if (task.verifier.toLowerCase() !== this.wallet.address.toLowerCase()) {
                console.log('  ⏭️  Not assigned as verifier for this task');
                return;
            }

            console.log('  👤 Executor:', task.executor);
            console.log('  📝 Submitted Result:', task.resultHash);

            // Independently execute the task
            const expectedResult = this.executeTaskIndependently(task.taskData);

            // Compare results
            const isValid = task.resultHash.toLowerCase() === expectedResult.toLowerCase();

            if (isValid) {
                console.log('  ✅ Result is VALID');
            } else {
                console.log('  ❌ Result is INVALID');
                console.log('  Expected:', expectedResult);
                console.log('  Got:     ', task.resultHash);
            }

            // Submit verification
            await this.submitVerification(taskId, isValid);

        } catch (error) {
            console.error('❌ Error verifying task:', error.message);
        }
    }

    /**
     * Submit verification verdict
     */
    async submitVerification(taskId, isValid) {
        try {
            console.log(`\n📤 Submitting verification for task ${taskId}...`);
            console.log('  Verdict:', isValid ? 'APPROVED ✅' : 'REJECTED ❌');

            const tx = await this.contract.verifyResult(taskId, isValid);
            console.log('  📤 Transaction sent:', tx.hash);

            const receipt = await tx.wait();
            console.log('  ✅ Verification submitted! Gas used:', receipt.gasUsed.toString());

            // Log expected payment
            const task = await this.contract.getTask(taskId);
            const verifierFee = task.escrowAmount * 5n / 100n; // 5% fee
            const totalPayment = isValid ? verifierFee : verifierFee + task.bondAmount;

            console.log('  💰 Expected payment:', ethers.formatEther(totalPayment), 'ETH');

            return true;
        } catch (error) {
            console.error('  ❌ Error submitting verification:', error.message);
            return false;
        }
    }

    /**
     * Listen for result submissions
     */
    async listenForResults() {
        console.log('\n👂 Listening for result submissions...\n');

        // Listen for ResultSubmitted events
        this.contract.on('ResultSubmitted', async (taskId, executor, resultHash) => {
            console.log('\n🔔 New result submitted!');
            console.log('  Task ID:', taskId.toString());
            console.log('  Executor:', executor);
            console.log('  Result Hash:', resultHash);

            // Wait a bit for the transaction to be confirmed
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verify the task
            await this.verifyTask(taskId);
        });

        // Also check for any existing unverified tasks
        await this.checkExistingTasks();
    }

    /**
     * Check for existing tasks that need verification
     */
    async checkExistingTasks() {
        try {
            const totalTasks = await this.contract.getTotalTasks();
            console.log(`📋 Checking ${totalTasks} existing tasks...\n`);

            for (let i = 0; i < totalTasks; i++) {
                const task = await this.contract.getTask(i);

                // Verify if task is in Submitted status (2) and we are the verifier
                if (task.status === 2 && task.verifier.toLowerCase() === this.wallet.address.toLowerCase()) {
                    await this.verifyTask(i);
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
                console.error('❌ Insufficient balance! Please fund the verifier wallet.');
                process.exit(1);
            }

            // Start listening
            await this.listenForResults();

        } catch (error) {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        }
    }
}

// Main execution
async function main() {
    if (!process.env.RPC_URL || !process.env.CONTRACT_ADDRESS || !process.env.VERIFIER_PRIVATE_KEY) {
        console.error('❌ Missing required environment variables!');
        console.error('Please set: RPC_URL, CONTRACT_ADDRESS, VERIFIER_PRIVATE_KEY');
        process.exit(1);
    }

    const agent = new VerifierAgent();
    await agent.start();
}

main().catch(console.error);
