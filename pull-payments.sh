cat > pull-payments.patch <<'PATCH'
*** Begin Patch
*** Update File: contracts/GaslessFlashArbAaveV3.sol
@@
-pragma solidity ^0.8.20;
+pragma solidity ^0.8.24;
@@
-import { ECDSA } from "openzeppelin/contracts/utils/cryptography/ECDSA.sol";
-import { EIP712 } from "openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import { ECDSA } from "openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+import { EIP712 } from "openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
@@
-contract GaslessFlashArbAaveV3 {
+contract GaslessFlashArbAaveV3 is ReentrancyGuard {
@@
-    address public treasury;
+    address public immutable treasury;
+    // pull-payments ledger
+    mapping(address => uint256) public withdrawable;
@@
-    constructor(address _treasury, address _hook) {
-        treasury = _treasury;
-        hook = IHook(_hook);
-        owner = msg.sender;
-    }
+    constructor(address _treasury, address _hook) {
+        require(_treasury != address(0), "treasury=0");
+        require(_hook != address(0), "hook=0");
+        treasury = _treasury;
+        hook = IHook(_hook);
+        owner = msg.sender;
+    }
@@
-    function setOwner(address _owner) external onlyOwner {
-        owner = _owner;
-    }
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+
+    function setOwner(address _owner) external onlyOwner {
+        require(_owner != address(0), "owner=0");
+        emit OwnershipTransferred(owner, _owner);
+        owner = _owner;
+    }
@@
-    function _distributeProfitNative(address solver, uint256 profitWei) internal {
-        uint256 toSolver = (profitWei * solverShareBps) / 10000;
-        uint256 toTreasury = profitWei - toSolver;
-
-        (bool ok1, ) = address(solver).call{value: toSolver}("");
-        (bool ok2, ) = address(treasury).call{value: toTreasury}("");
-        // Note: original code handled returns but left as-is; now we convert to pull pattern downstream
-    }
+    /// Convert push payments into pull-payments: credit balances rather than sending ETH directly.
+    function _distributeProfitNative(address solver, uint256 profitWei) internal {
+        if (profitWei == 0) return;
+        uint256 toSolver = (profitWei * solverShareBps) / 10000;
+        uint256 toTreasury = profitWei - toSolver;
+
+        // Effects first: credit withdrawable mapping
+        if (toSolver > 0) {
+            withdrawable[solver] += toSolver;
+        }
+        if (toTreasury > 0) {
+            withdrawable[treasury] += toTreasury;
+        }
+    }
+
+    /// Withdraw credited ETH. Uses ReentrancyGuard (pull payments).
+    function withdraw() external nonReentrant {
+        uint256 amount = withdrawable[msg.sender];
+        require(amount > 0, "No funds");
+        withdrawable[msg.sender] = 0;
+        (bool ok, ) = payable(msg.sender).call{value: amount}("");
+        require(ok, "withdraw failed");
+    }
*** End Patch
PATCH

# 2) validate and apply patch
git apply --allow-empty --check pull-payments.patch || { echo "patch check failed"; exit 1; }
git apply --allow-empty pull-payments.patch || { echo "patch apply failed"; exit 1; }

# 3) build, test, slither
forge clean
forge build || { echo "forge build failed"; exit 1; }
forge test -v || { echo "tests failed"; exit 1; }

# 4) run slither (normal)
slither . || true

# 5) find any other push-payment occurrences (scan repository)
echo "Occurrences of call{value or .call{value (search results):"
rg --hidden --no-ignore-vcs --line-number "call\{value:" || true
rg --hidden --no-ignore-vcs --line-number "\.call\{value:" || true
