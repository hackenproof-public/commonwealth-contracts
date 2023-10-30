// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

abstract contract ClaimableVesting is OwnablePausable, ReentrancyGuardUpgradeable {
    IERC20Upgradeable public claimableCurrency;

    address public claimDataSource;

    uint256 public vestingStartTimestamp;

    mapping(address => uint256) public claimedAmounts;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address claimableCurrency_,
        address claimDataSource_,
        uint256 vestingStartTimestamp_
    ) public virtual initializer onlyInitializing {
        __OwnablePausable_init(owner_);
        __ReentrancyGuard_init();
        claimableCurrency = IERC20Upgradeable(claimableCurrency_);
        claimDataSource = claimDataSource_;
        vestingStartTimestamp = vestingStartTimestamp_;
    }

    function claim(uint256 amount) external nonReentrant whenNotPaused returns (bool) {
        require(claimableCurrency.balanceOf(address(this)) >= amount, "Not enough currency to process the claim!");
        require(
            claimableAmount(_msgSender()) - claimedAmounts[_msgSender()] >= amount,
            "You can't claim that many tokens"
        );

        claimedAmounts[_msgSender()] += amount;
        return claimableCurrency.transfer(_msgSender(), amount);
    }

    function claimableAmount(address claimer) public view virtual returns (uint256);

    uint256[46] private __gap;
}
