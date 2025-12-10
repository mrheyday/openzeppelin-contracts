 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.20;

 contract UniswapV4ValidationHook {
     address public owner;
     uint256 public minProfitWei;
     mapping(address => bool) public allowedSolvers;

     event MinProfitUpdated(uint256 oldVal, uint256 newVal);
     event SolverToggled(address solver, bool enabled);
     event HookValidated(address indexed solver, uint256 expectedProfitWei, bytes32 actionsHash);

     modifier onlyOwner() {
         require(msg.sender == owner, "Only owner");
         _;
     }

     constructor(uint256 initialMinProfitWei) {
         owner = msg.sender;
         minProfitWei = initialMinProfitWei;
     }

     function setMinProfit(uint256 newMin) external onlyOwner {
         emit MinProfitUpdated(minProfitWei, newMin);
         minProfitWei = newMin;
     }

     function toggleSolver(address solver, bool enable) external onlyOwner {
         allowedSolvers[solver] = enable;
         emit SolverToggled(solver, enable);
     }

     function validate(address solver, uint256 expectedProfitWei, bytes32 actionsHash) external returns (bool) {
         require(allowedSolvers[solver], "Solver not allowed");
         require(expectedProfitWei >= minProfitWei, "Profit below min");
         emit HookValidated(solver, expectedProfitWei, actionsHash);
         return true;
     }

     function transferOwnership(address newOwner) external onlyOwner {
         owner = newOwner;
     }
 }
