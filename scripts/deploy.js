import hre from "hardhat";
const { ethers } = hre;

async function main() {
    console.log("🚀 Deploying CovenantEscrow contract...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📍 Deploying with account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

    // Deploy contract
    const CovenantEscrow = await ethers.getContractFactory("CovenantEscrow");
    const contract = await CovenantEscrow.deploy();

    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log("✅ CovenantEscrow deployed to:", contractAddress);
    console.log("\n📝 Update your .env file with:");
    console.log(`CONTRACT_ADDRESS=${contractAddress}`);

    // Display contract info
    console.log("\n📊 Contract Configuration:");
    console.log("  Minimum Bond: 1% of escrow");
    console.log("  Task Timeout: 1 hour");
    console.log("  Verification Timeout: 30 minutes");
    console.log("  Verifier Fee: 5% of escrow");
    console.log("  Reputation Success: +10");
    console.log("  Reputation Failure: -20");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
