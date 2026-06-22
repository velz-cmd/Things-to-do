// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DeputyEscrow — proof-of-resolution settlement on Arc
/// @notice Locks user budget; releases success fee to deputy oracle only after verified proof hash
contract DeputyEscrow {
    enum TaskStatus {
        None,
        Locked,
        ProofSubmitted,
        Released,
        Refunded
    }

    struct Task {
        address user;
        bytes32 taskRef;
        uint256 lockedAmount;
        uint256 successFee;
        bytes32 proofHash;
        TaskStatus status;
    }

    address public immutable deputyOracle;
    uint256 public nextTaskId = 1;
    mapping(uint256 => Task) public tasks;

    event TaskCreated(
        uint256 indexed taskId,
        address indexed user,
        bytes32 taskRef,
        uint256 lockedAmount,
        uint256 successFee
    );
    event ProofSubmitted(uint256 indexed taskId, bytes32 proofHash);
    event Released(uint256 indexed taskId, address indexed deputy, uint256 amount);
    event Refunded(uint256 indexed taskId, address indexed user, uint256 amount);

    error InvalidAmount();
    error Unauthorized();
    error InvalidStatus();
    error ProofMismatch();

    constructor(address _deputyOracle) {
        deputyOracle = _deputyOracle;
    }

    /// @notice User locks funds for a task. Native USDC on Arc via msg.value.
    function createTask(bytes32 taskRef, uint256 successFee) external payable returns (uint256 taskId) {
        if (msg.value == 0 || msg.value < successFee) revert InvalidAmount();

        taskId = nextTaskId++;
        tasks[taskId] = Task({
            user: msg.sender,
            taskRef: taskRef,
            lockedAmount: msg.value,
            successFee: successFee,
            proofHash: bytes32(0),
            status: TaskStatus.Locked
        });

        emit TaskCreated(taskId, msg.sender, taskRef, msg.value, successFee);
    }

    /// @notice Oracle records proof hash after off-chain verification
    function submitProof(uint256 taskId, bytes32 proofHash) external {
        if (msg.sender != deputyOracle) revert Unauthorized();
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Locked) revert InvalidStatus();
        t.proofHash = proofHash;
        t.status = TaskStatus.ProofSubmitted;
        emit ProofSubmitted(taskId, proofHash);
    }

    /// @notice Release success fee to deputy; refund remainder to user
    function releaseOnProof(uint256 taskId) external {
        if (msg.sender != deputyOracle) revert Unauthorized();
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.ProofSubmitted) revert InvalidStatus();
        if (t.proofHash == bytes32(0)) revert ProofMismatch();

        t.status = TaskStatus.Released;
        uint256 fee = t.successFee;
        uint256 remainder = t.lockedAmount - fee;

        (bool sentFee, ) = deputyOracle.call{value: fee}("");
        require(sentFee, "fee transfer failed");

        if (remainder > 0) {
            (bool sentUser, ) = t.user.call{value: remainder}("");
            require(sentUser, "refund transfer failed");
        }

        emit Released(taskId, deputyOracle, fee);
    }

    function refundUser(uint256 taskId) external {
        if (msg.sender != deputyOracle) revert Unauthorized();
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Locked) revert InvalidStatus();
        t.status = TaskStatus.Refunded;
        (bool sent, ) = t.user.call{value: t.lockedAmount}("");
        require(sent, "refund failed");
        emit Refunded(taskId, t.user, t.lockedAmount);
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }
}
