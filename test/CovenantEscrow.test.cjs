const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CovenantEscrow", function () {
    // Fixture to deploy contract
    async function deployCovenantFixture() {
        const [creator, executor, verifier, other] = await ethers.getSigners();

        const CovenantEscrow = await ethers.getContractFactory("CovenantEscrow");
        const contract = await CovenantEscrow.deploy();

        return { contract, creator, executor, verifier, other };
    }

    describe("Task Creation", function () {
        it("Should create a task with escrow", async function () {
            const { contract, creator, verifier } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");
            const escrowAmount = ethers.parseEther("1.0");

            await expect(
                contract.connect(creator).createTask(taskData, verifier.address, {
                    value: escrowAmount,
                })
            )
                .to.emit(contract, "TaskCreated")
                .withArgs(0, creator.address, verifier.address, escrowAmount, taskData);

            const task = await contract.getTask(0);
            expect(task.creator).to.equal(creator.address);
            expect(task.verifier).to.equal(verifier.address);
            expect(task.escrowAmount).to.equal(escrowAmount);
            expect(task.status).to.equal(0); // Created
        });

        it("Should reject task creation with zero escrow", async function () {
            const { contract, creator, verifier } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");

            await expect(
                contract.connect(creator).createTask(taskData, verifier.address, {
                    value: 0,
                })
            ).to.be.revertedWithCustomError(contract, "InsufficientEscrow");
        });

        it("Should reject invalid verifier address", async function () {
            const { contract, creator } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");
            const escrowAmount = ethers.parseEther("1.0");

            await expect(
                contract.connect(creator).createTask(taskData, ethers.ZeroAddress, {
                    value: escrowAmount,
                })
            ).to.be.revertedWithCustomError(contract, "InvalidVerifier");
        });
    });

    describe("Task Acceptance", function () {
        it("Should accept task with sufficient bond", async function () {
            const { contract, creator, executor, verifier } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");
            const escrowAmount = ethers.parseEther("1.0");

            await contract.connect(creator).createTask(taskData, verifier.address, {
                value: escrowAmount,
            });

            const bondAmount = ethers.parseEther("0.01"); // 1% of escrow

            await expect(
                contract.connect(executor).acceptTask(0, { value: bondAmount })
            )
                .to.emit(contract, "TaskAccepted")
                .withArgs(0, executor.address, bondAmount);

            const task = await contract.getTask(0);
            expect(task.executor).to.equal(executor.address);
            expect(task.bondAmount).to.equal(bondAmount);
            expect(task.status).to.equal(1); // Accepted
        });

        it("Should reject insufficient bond", async function () {
            const { contract, creator, executor, verifier } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");
            const escrowAmount = ethers.parseEther("1.0");

            await contract.connect(creator).createTask(taskData, verifier.address, {
                value: escrowAmount,
            });

            const insufficientBond = ethers.parseEther("0.001"); // Less than 1%

            await expect(
                contract.connect(executor).acceptTask(0, { value: insufficientBond })
            ).to.be.revertedWithCustomError(contract, "InsufficientBond");
        });
    });

    describe("Result Submission", function () {
        it("Should submit result after accepting task", async function () {
            const { contract, creator, executor, verifier } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");
            const escrowAmount = ethers.parseEther("1.0");

            await contract.connect(creator).createTask(taskData, verifier.address, {
                value: escrowAmount,
            });

            const bondAmount = ethers.parseEther("0.01");
            await contract.connect(executor).acceptTask(0, { value: bondAmount });

            const resultHash = ethers.id("result-hash");

            await expect(contract.connect(executor).submitResult(0, resultHash))
                .to.emit(contract, "ResultSubmitted")
                .withArgs(0, executor.address, resultHash);

            const task = await contract.getTask(0);
            expect(task.resultHash).to.equal(resultHash);
            expect(task.status).to.equal(2); // Submitted
        });

        it("Should reject submission from non-executor", async function () {
            const { contract, creator, executor, verifier, other } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");
            const escrowAmount = ethers.parseEther("1.0");

            await contract.connect(creator).createTask(taskData, verifier.address, {
                value: escrowAmount,
            });

            const bondAmount = ethers.parseEther("0.01");
            await contract.connect(executor).acceptTask(0, { value: bondAmount });

            const resultHash = ethers.id("result-hash");

            await expect(
                contract.connect(other).submitResult(0, resultHash)
            ).to.be.revertedWithCustomError(contract, "UnauthorizedExecutor");
        });
    });

    describe("Verification and Resolution", function () {
        it("Should approve valid result and pay executor", async function () {
            const { contract, creator, executor, verifier } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");
            const escrowAmount = ethers.parseEther("1.0");

            await contract.connect(creator).createTask(taskData, verifier.address, {
                value: escrowAmount,
            });

            const bondAmount = ethers.parseEther("0.01");
            await contract.connect(executor).acceptTask(0, { value: bondAmount });

            const resultHash = ethers.id("result-hash");
            await contract.connect(executor).submitResult(0, resultHash);

            const executorBalanceBefore = await ethers.provider.getBalance(executor.address);
            const verifierBalanceBefore = await ethers.provider.getBalance(verifier.address);

            await expect(contract.connect(verifier).verifyResult(0, true))
                .to.emit(contract, "ResultVerified")
                .withArgs(0, verifier.address, true)
                .to.emit(contract, "TaskResolved");

            const task = await contract.getTask(0);
            expect(task.status).to.equal(4); // Resolved
            expect(task.verdict).to.equal(1); // Approved

            // Check reputation
            const executorReputation = await contract.getReputation(executor.address);
            expect(executorReputation).to.equal(10); // REPUTATION_SUCCESS

            // Check balances (executor gets escrow - 5% fee + bond back)
            const executorBalanceAfter = await ethers.provider.getBalance(executor.address);
            const verifierBalanceAfter = await ethers.provider.getBalance(verifier.address);

            const verifierFee = (escrowAmount * 5n) / 100n;
            const executorPayment = escrowAmount - verifierFee + bondAmount;

            expect(executorBalanceAfter - executorBalanceBefore).to.equal(executorPayment);
            expect(verifierBalanceAfter - verifierBalanceBefore).to.be.closeTo(
                verifierFee,
                ethers.parseEther("0.001") // Allow for gas costs
            );
        });

        it("Should reject invalid result and slash executor", async function () {
            const { contract, creator, executor, verifier } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");
            const escrowAmount = ethers.parseEther("1.0");

            await contract.connect(creator).createTask(taskData, verifier.address, {
                value: escrowAmount,
            });

            const bondAmount = ethers.parseEther("0.01");
            await contract.connect(executor).acceptTask(0, { value: bondAmount });

            const resultHash = ethers.id("result-hash");
            await contract.connect(executor).submitResult(0, resultHash);

            await expect(contract.connect(verifier).verifyResult(0, false))
                .to.emit(contract, "ResultVerified")
                .withArgs(0, verifier.address, false)
                .to.emit(contract, "TaskResolved");

            const task = await contract.getTask(0);
            expect(task.status).to.equal(4); // Resolved
            expect(task.verdict).to.equal(2); // Rejected

            // Check reputation
            const executorReputation = await contract.getReputation(executor.address);
            expect(executorReputation).to.equal(-20); // REPUTATION_FAILURE

            // Verify contract balance is zero (all funds distributed)
            const contractBalance = await ethers.provider.getBalance(await contract.getAddress());
            expect(contractBalance).to.equal(0);
        });
    });

    describe("Reputation System", function () {
        it("Should track reputation across multiple tasks", async function () {
            const { contract, creator, executor, verifier } = await loadFixture(deployCovenantFixture);

            const taskData = ethers.id("test-task-data");
            const escrowAmount = ethers.parseEther("1.0");

            // Task 1: Success
            await contract.connect(creator).createTask(taskData, verifier.address, {
                value: escrowAmount,
            });
            await contract.connect(executor).acceptTask(0, { value: ethers.parseEther("0.01") });
            await contract.connect(executor).submitResult(0, ethers.id("result1"));
            await contract.connect(verifier).verifyResult(0, true);

            let reputation = await contract.getReputation(executor.address);
            expect(reputation).to.equal(10);

            // Task 2: Failure
            await contract.connect(creator).createTask(taskData, verifier.address, {
                value: escrowAmount,
            });
            await contract.connect(executor).acceptTask(1, { value: ethers.parseEther("0.01") });
            await contract.connect(executor).submitResult(1, ethers.id("result2"));
            await contract.connect(verifier).verifyResult(1, false);

            reputation = await contract.getReputation(executor.address);
            expect(reputation).to.equal(-10); // 10 + (-20) = -10
        });
    });
});
