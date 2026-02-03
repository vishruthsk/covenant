// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CovenantEscrow
 * @notice Onchain escrow + verification system for autonomous agent tasks
 * @dev Simple, production-quality MVP with economic staking and reputation
 */
contract CovenantEscrow {
    // ============ State Variables ============

    uint256 public taskCounter;
    uint256 public constant MINIMUM_BOND_PERCENTAGE = 1; // 1% of escrow
    uint256 public constant TASK_TIMEOUT = 1 hours;
    uint256 public constant VERIFICATION_TIMEOUT = 30 minutes;
    uint256 public constant VERIFIER_FEE_PERCENTAGE = 5; // 5% of escrow
    
    int256 public constant REPUTATION_SUCCESS = 10;
    int256 public constant REPUTATION_FAILURE = -20;

    // ============ Enums ============

    enum TaskStatus {
        Created,
        Accepted,
        Submitted,
        Verified,
        Resolved
    }

    enum VerificationVerdict {
        Pending,
        Approved,
        Rejected
    }

    // ============ Structs ============

    struct Task {
        address creator;
        address executor;
        address verifier;
        uint256 escrowAmount;
        uint256 bondAmount;
        TaskStatus status;
        bytes32 taskData;
        bytes32 resultHash;
        VerificationVerdict verdict;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 submittedAt;
    }

    // ============ Storage ============

    mapping(uint256 => Task) public tasks;
    mapping(address => int256) public reputation;

    // ============ Events ============

    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        address indexed verifier,
        uint256 escrowAmount,
        bytes32 taskData
    );

    event TaskAccepted(
        uint256 indexed taskId,
        address indexed executor,
        uint256 bondAmount
    );

    event ResultSubmitted(
        uint256 indexed taskId,
        address indexed executor,
        bytes32 resultHash
    );

    event ResultVerified(
        uint256 indexed taskId,
        address indexed verifier,
        bool isValid
    );

    event TaskResolved(
        uint256 indexed taskId,
        address indexed executor,
        bool executorPaid,
        int256 reputationChange
    );

    // ============ Errors ============

    error InsufficientEscrow();
    error InvalidVerifier();
    error InvalidTaskId();
    error InvalidTaskStatus();
    error UnauthorizedExecutor();
    error UnauthorizedVerifier();
    error InsufficientBond();
    error TaskNotTimedOut();
    error TransferFailed();

    // ============ Modifiers ============

    modifier taskExists(uint256 taskId) {
        if (taskId >= taskCounter) revert InvalidTaskId();
        _;
    }

    modifier onlyTaskCreator(uint256 taskId) {
        if (tasks[taskId].creator != msg.sender) revert UnauthorizedExecutor();
        _;
    }

    modifier onlyTaskExecutor(uint256 taskId) {
        if (tasks[taskId].executor != msg.sender) revert UnauthorizedExecutor();
        _;
    }

    modifier onlyTaskVerifier(uint256 taskId) {
        if (tasks[taskId].verifier != msg.sender) revert UnauthorizedVerifier();
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Create a new task with escrowed funds
     * @param taskData Hash of the task input data
     * @param verifier Address of the verifier agent
     */
    function createTask(bytes32 taskData, address verifier) 
        external 
        payable 
        returns (uint256 taskId) 
    {
        if (msg.value == 0) revert InsufficientEscrow();
        if (verifier == address(0) || verifier == msg.sender) revert InvalidVerifier();

        taskId = taskCounter++;

        tasks[taskId] = Task({
            creator: msg.sender,
            executor: address(0),
            verifier: verifier,
            escrowAmount: msg.value,
            bondAmount: 0,
            status: TaskStatus.Created,
            taskData: taskData,
            resultHash: bytes32(0),
            verdict: VerificationVerdict.Pending,
            createdAt: block.timestamp,
            acceptedAt: 0,
            submittedAt: 0
        });

        emit TaskCreated(taskId, msg.sender, verifier, msg.value, taskData);
    }

    /**
     * @notice Accept a task and post bond
     * @param taskId The task to accept
     */
    function acceptTask(uint256 taskId) 
        external 
        payable 
        taskExists(taskId) 
    {
        Task storage task = tasks[taskId];
        
        if (task.status != TaskStatus.Created) revert InvalidTaskStatus();
        if (msg.sender == task.creator || msg.sender == task.verifier) revert UnauthorizedExecutor();
        
        uint256 minimumBond = (task.escrowAmount * MINIMUM_BOND_PERCENTAGE) / 100;
        if (msg.value < minimumBond) revert InsufficientBond();

        task.executor = msg.sender;
        task.bondAmount = msg.value;
        task.status = TaskStatus.Accepted;
        task.acceptedAt = block.timestamp;

        emit TaskAccepted(taskId, msg.sender, msg.value);
    }

    /**
     * @notice Submit task result
     * @param taskId The task ID
     * @param resultHash Hash of the computed result
     */
    function submitResult(uint256 taskId, bytes32 resultHash) 
        external 
        taskExists(taskId)
        onlyTaskExecutor(taskId)
    {
        Task storage task = tasks[taskId];
        
        if (task.status != TaskStatus.Accepted) revert InvalidTaskStatus();

        task.resultHash = resultHash;
        task.status = TaskStatus.Submitted;
        task.submittedAt = block.timestamp;

        emit ResultSubmitted(taskId, msg.sender, resultHash);
    }

    /**
     * @notice Verify the submitted result
     * @param taskId The task ID
     * @param isValid Whether the result is valid
     */
    function verifyResult(uint256 taskId, bool isValid) 
        external 
        taskExists(taskId)
        onlyTaskVerifier(taskId)
    {
        Task storage task = tasks[taskId];
        
        if (task.status != TaskStatus.Submitted) revert InvalidTaskStatus();

        task.verdict = isValid ? VerificationVerdict.Approved : VerificationVerdict.Rejected;
        task.status = TaskStatus.Verified;

        emit ResultVerified(taskId, msg.sender, isValid);

        // Automatically resolve after verification
        _resolveTask(taskId);
    }

    /**
     * @notice Resolve task and distribute funds
     * @param taskId The task ID
     */
    function resolveTask(uint256 taskId) 
        external 
        taskExists(taskId)
    {
        Task storage task = tasks[taskId];
        
        // Allow manual resolution only if verification timed out
        if (task.status == TaskStatus.Submitted) {
            if (block.timestamp < task.submittedAt + VERIFICATION_TIMEOUT) {
                revert TaskNotTimedOut();
            }
            // Timeout: assume approved
            task.verdict = VerificationVerdict.Approved;
            task.status = TaskStatus.Verified;
        } else if (task.status != TaskStatus.Verified) {
            revert InvalidTaskStatus();
        }

        _resolveTask(taskId);
    }

    /**
     * @notice Internal resolution logic
     */
    function _resolveTask(uint256 taskId) internal {
        Task storage task = tasks[taskId];
        
        if (task.status != TaskStatus.Verified) revert InvalidTaskStatus();
        
        task.status = TaskStatus.Resolved;

        uint256 verifierFee = (task.escrowAmount * VERIFIER_FEE_PERCENTAGE) / 100;
        bool executorPaid = false;
        int256 reputationChange = 0;

        if (task.verdict == VerificationVerdict.Approved) {
            // Valid result: pay executor escrow + bond back, update reputation
            uint256 executorPayment = task.escrowAmount - verifierFee + task.bondAmount;
            
            (bool executorSuccess, ) = task.executor.call{value: executorPayment}("");
            if (!executorSuccess) revert TransferFailed();

            reputation[task.executor] += REPUTATION_SUCCESS;
            executorPaid = true;
            reputationChange = REPUTATION_SUCCESS;
        } else {
            // Invalid result: slash bond, give to verifier
            // Verifier gets their fee + slashed bond
            verifierFee += task.bondAmount;
            
            // Return escrow minus verifier fee to creator
            uint256 creatorRefund = task.escrowAmount - (task.escrowAmount * VERIFIER_FEE_PERCENTAGE) / 100;
            (bool creatorSuccess, ) = task.creator.call{value: creatorRefund}("");
            if (!creatorSuccess) revert TransferFailed();

            reputation[task.executor] += REPUTATION_FAILURE;
            reputationChange = REPUTATION_FAILURE;
        }

        // Pay verifier fee
        (bool verifierSuccess, ) = task.verifier.call{value: verifierFee}("");
        if (!verifierSuccess) revert TransferFailed();

        emit TaskResolved(taskId, task.executor, executorPaid, reputationChange);
    }

    /**
     * @notice Claim task if executor times out
     * @param taskId The task ID
     */
    function claimTaskTimeout(uint256 taskId) 
        external 
        taskExists(taskId)
        onlyTaskCreator(taskId)
    {
        Task storage task = tasks[taskId];
        
        if (task.status != TaskStatus.Accepted) revert InvalidTaskStatus();
        if (block.timestamp < task.acceptedAt + TASK_TIMEOUT) revert TaskNotTimedOut();

        // Return escrow and bond to creator
        uint256 totalRefund = task.escrowAmount + task.bondAmount;
        task.status = TaskStatus.Resolved;

        (bool success, ) = task.creator.call{value: totalRefund}("");
        if (!success) revert TransferFailed();

        // Penalize executor reputation
        reputation[task.executor] += REPUTATION_FAILURE;

        emit TaskResolved(taskId, task.executor, false, REPUTATION_FAILURE);
    }

    // ============ View Functions ============

    /**
     * @notice Get task details
     */
    function getTask(uint256 taskId) 
        external 
        view 
        taskExists(taskId)
        returns (Task memory) 
    {
        return tasks[taskId];
    }

    /**
     * @notice Get reputation score
     */
    function getReputation(address account) external view returns (int256) {
        return reputation[account];
    }

    /**
     * @notice Get total number of tasks
     */
    function getTotalTasks() external view returns (uint256) {
        return taskCounter;
    }
}
