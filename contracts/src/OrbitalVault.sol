// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OrbitalVault
/// @notice A native-token staking pool with a separately funded fixed-rate reward reserve.
contract OrbitalVault {
    uint256 public constant APR_BPS = 1_280; // 12.80%
    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;

    struct Position {
        uint128 principal;
        uint128 accrued;
        uint64 updatedAt;
    }

    mapping(address => Position) private positions;
    uint256 public totalPrincipal;
    uint256 public rewardReserve;
    uint256 public totalRewardsPaid;
    uint256 private locked = 1;

    error InvalidAmount();
    error InsufficientPrincipal();
    error InsufficientRewardReserve();
    error TransferFailed();
    error ReentrantCall();

    event RewardsFunded(address indexed funder, uint256 amount);
    event Deposited(address indexed account, uint256 amount, uint256 newPrincipal);
    event Withdrawn(address indexed account, uint256 amount, uint256 remainingPrincipal);
    event RewardClaimed(address indexed account, uint256 amount);
    event RewardCompounded(address indexed account, uint256 amount, uint256 newPrincipal);

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    function fundRewards() external payable {
        if (msg.value == 0) revert InvalidAmount();
        rewardReserve += msg.value;
        emit RewardsFunded(msg.sender, msg.value);
    }

    function deposit() external payable nonReentrant {
        if (msg.value == 0 || msg.value > type(uint128).max) revert InvalidAmount();
        _checkpoint(msg.sender);
        Position storage position = positions[msg.sender];
        uint256 nextPrincipal = uint256(position.principal) + msg.value;
        if (nextPrincipal > type(uint128).max) revert InvalidAmount();
        position.principal = uint128(nextPrincipal);
        totalPrincipal += msg.value;
        emit Deposited(msg.sender, msg.value, nextPrincipal);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        _checkpoint(msg.sender);
        Position storage position = positions[msg.sender];
        if (amount > position.principal) revert InsufficientPrincipal();
        position.principal = uint128(uint256(position.principal) - amount);
        totalPrincipal -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount, position.principal);
    }

    function claim() external nonReentrant returns (uint256 amount) {
        _checkpoint(msg.sender);
        Position storage position = positions[msg.sender];
        amount = position.accrued;
        if (amount == 0) revert InvalidAmount();
        if (amount > rewardReserve) revert InsufficientRewardReserve();
        position.accrued = 0;
        rewardReserve -= amount;
        totalRewardsPaid += amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit RewardClaimed(msg.sender, amount);
    }

    function compound() external nonReentrant returns (uint256 amount) {
        _checkpoint(msg.sender);
        Position storage position = positions[msg.sender];
        amount = position.accrued;
        if (amount == 0) revert InvalidAmount();
        if (amount > rewardReserve) revert InsufficientRewardReserve();
        uint256 nextPrincipal = uint256(position.principal) + amount;
        if (nextPrincipal > type(uint128).max) revert InvalidAmount();
        position.accrued = 0;
        position.principal = uint128(nextPrincipal);
        rewardReserve -= amount;
        totalPrincipal += amount;
        totalRewardsPaid += amount;
        emit RewardCompounded(msg.sender, amount, nextPrincipal);
    }

    function pendingRewards(address account) public view returns (uint256) {
        Position memory position = positions[account];
        if (position.principal == 0 || position.updatedAt == 0) return position.accrued;
        uint256 elapsed = block.timestamp - position.updatedAt;
        return uint256(position.accrued) + (uint256(position.principal) * APR_BPS * elapsed) / (BPS * YEAR);
    }

    function getPosition(address account) external view returns (uint256 principal, uint256 pending, uint64 updatedAt) {
        Position memory position = positions[account];
        return (position.principal, pendingRewards(account), position.updatedAt);
    }

    function solvency() external view returns (uint256 contractBalance, uint256 principalLiability, uint256 rewardsAvailable) {
        return (address(this).balance, totalPrincipal, rewardReserve);
    }

    function _checkpoint(address account) private {
        Position storage position = positions[account];
        if (position.updatedAt != 0 && position.principal != 0) {
            uint256 earned = (uint256(position.principal) * APR_BPS * (block.timestamp - position.updatedAt)) / (BPS * YEAR);
            uint256 nextAccrued = uint256(position.accrued) + earned;
            if (nextAccrued > type(uint128).max) revert InvalidAmount();
            position.accrued = uint128(nextAccrued);
        }
        position.updatedAt = uint64(block.timestamp);
    }

    receive() external payable { revert InvalidAmount(); }
}
