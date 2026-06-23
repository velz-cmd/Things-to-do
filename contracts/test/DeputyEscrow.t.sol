// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DeputyEscrow} from "../src/DeputyEscrow.sol";

contract DeputyEscrowTest is Test {
    DeputyEscrow public escrow;
    address public oracle = address(0xBEEF);
    address public user = address(0xCAFE);

    function setUp() public {
        escrow = new DeputyEscrow(oracle);
        vm.deal(user, 10 ether);
    }

    function test_createTask_locksFunds() public {
        vm.prank(user);
        uint256 taskId = escrow.createTask{value: 1 ether}(keccak256("task-1"), 0.2 ether);
        assertEq(taskId, 1);

        DeputyEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(uint256(t.status), uint256(DeputyEscrow.TaskStatus.Locked));
        assertEq(t.lockedAmount, 1 ether);
    }

    function test_releaseOnProof() public {
        vm.prank(user);
        uint256 taskId = escrow.createTask{value: 1 ether}(keccak256("task-1"), 0.2 ether);
        bytes32 proof = keccak256("verified-proof");

        vm.prank(oracle);
        escrow.submitProof(taskId, proof);

        uint256 oracleBefore = oracle.balance;
        vm.prank(oracle);
        escrow.releaseOnProof(taskId);

        assertEq(oracle.balance, oracleBefore + 0.2 ether);
        DeputyEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(uint256(t.status), uint256(DeputyEscrow.TaskStatus.Released));
    }

    function test_refundUser() public {
        vm.prank(user);
        uint256 taskId = escrow.createTask{value: 1 ether}(keccak256("task-1"), 0.2 ether);

        uint256 userBefore = user.balance;
        vm.prank(oracle);
        escrow.refundUser(taskId);

        assertEq(user.balance, userBefore + 1 ether);
        DeputyEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(uint256(t.status), uint256(DeputyEscrow.TaskStatus.Refunded));
    }
}
