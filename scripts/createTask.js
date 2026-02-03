import { ethers } from 'ethers';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const CONTRACT_ABI = [
    "function createTask(bytes32 taskData, address verifier) external payable returns (uint256 taskId)",
    "function getTask(uint256 taskId) external view returns (tuple(address creator, address executor, address verifier, uint256 escrowAmount, uint256 bondAmount, uint8 status, bytes32 taskData, bytes32 resultHash, uint8 verdict, uint256 createdAt, uint256 acceptedAt, uint256 submittedAt))",
    "event TaskCreated(uint256 indexed taskId, address indexed creator, address indexed verifier, uint256 escrowAmount, bytes32 taskData)"
];

async function main() {
    console.log('🎯 Creating test task...\n');

    // Setup
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.CREATOR_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
        process.env.CONTRACT_ADDRESS,
        CONTRACT_ABI,
        wallet
    );

    console.log('👤 Creator:', wallet.address);
    console.log('📜 Contract:', process.env.CONTRACT_ADDRESS);

    // Get verifier address from private key
    const verifierWallet = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY);
    console.log('🔍 Verifier:', verifierWallet.address);

    // Create task data (a random hex string that will be hashed)
    const taskInput = crypto.randomBytes(32).toString('hex');
    const taskData = '0x' + taskInput;

    console.log('\n📊 Task Data:', taskData);

    // Calculate expected result (for reference)
    const expectedHash = '0x' + crypto.createHash('sha256').update(taskInput, 'hex').digest('hex');
    console.log('🔐 Expected Result:', expectedHash);

    // Create task with escrow
    const escrowAmount = ethers.parseEther('0.1'); // 0.1 ETH
    console.log('\n💰 Escrow Amount:', ethers.formatEther(escrowAmount), 'ETH');

    console.log('\n📤 Creating task...');
    const tx = await contract.createTask(taskData, verifierWallet.address, {
        value: escrowAmount
    });

    console.log('⏳ Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Task created! Gas used:', receipt.gasUsed.toString());

    // Get task ID from event
    const event = receipt.logs.find(log => {
        try {
            const parsed = contract.interface.parseLog(log);
            return parsed.name === 'TaskCreated';
        } catch {
            return false;
        }
    });

    if (event) {
        const parsed = contract.interface.parseLog(event);
        const taskId = parsed.args.taskId;
        console.log('\n🎉 Task ID:', taskId.toString());

        // Fetch and display task details
        const task = await contract.getTask(taskId);
        console.log('\n📋 Task Details:');
        console.log('  Creator:', task.creator);
        console.log('  Verifier:', task.verifier);
        console.log('  Escrow:', ethers.formatEther(task.escrowAmount), 'ETH');
        console.log('  Status:', ['Created', 'Accepted', 'Submitted', 'Verified', 'Resolved'][task.status]);
        console.log('\n✨ Executor and Verifier agents should now process this task automatically!');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
