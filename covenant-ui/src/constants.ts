export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Localhost

export const CONTRACT_ABI = [
    "event TaskCreated(uint256 indexed taskId, address indexed creator, address indexed verifier, uint256 escrowAmount, bytes32 taskData)",
    "event TaskAccepted(uint256 indexed taskId, address indexed executor, uint256 bondAmount)",
    "event ResultSubmitted(uint256 indexed taskId, address indexed executor, bytes32 resultHash)",
    "event ResultVerified(uint256 indexed taskId, address indexed verifier, bool isValid)",
    "function acceptTask(uint256 taskId) external payable",
    "function submitResult(uint256 taskId, bytes32 resultHash) external",
    "function verifyResult(uint256 taskId, bool isValid) external",
    "function createTask(address _verifier, bytes32 _taskData) external payable",
    "function getTask(uint256 taskId) external view returns (tuple(address creator, address executor, address verifier, uint256 escrowAmount, uint256 bondAmount, uint8 status, bytes32 taskData, bytes32 resultHash, uint8 verdict, uint256 createdAt, uint256 acceptedAt, uint256 submittedAt))",
    "function getTotalTasks() external view returns (uint256)"
];
