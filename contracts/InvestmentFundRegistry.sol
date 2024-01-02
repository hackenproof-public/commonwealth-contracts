// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {IInvestmentFundRegistry} from "./interfaces/IInvestmentFundRegistry.sol";

error InvestmentFundRegistry__OwnerAccountZeroAddress();
error InvestmentFundRegistry__InvestmentFundZeroAddress();
error InvestmentFundRegistry__InvestmentFundAlreadyAdded();
error InvestmentFundRegistry__InvestmentFundNotAdded();
error InvestmentFundRegistry__InvestmentFundAddFailed();
error InvestmentFundRegistry__InvestmentFundRemoveFailed();

/**
 * @title Investment fund registry contract
 */
contract InvestmentFundRegistry is OwnableUpgradeable, IInvestmentFundRegistry {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    EnumerableSetUpgradeable.AddressSet private _funds;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param owner Address of registry contract owner
     */
    function initialize(address owner) public initializer {
        if (owner == address(0)) revert InvestmentFundRegistry__OwnerAccountZeroAddress();

        __Context_init();
        __Ownable_init();

        _transferOwnership(owner);
    }

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function addFund(address fundAddress) external onlyOwner {
        if (fundAddress == address(0)) revert InvestmentFundRegistry__InvestmentFundZeroAddress();
        if (_funds.contains(fundAddress)) revert InvestmentFundRegistry__InvestmentFundAlreadyAdded();
        if (!_funds.add(fundAddress)) revert InvestmentFundRegistry__InvestmentFundAddFailed();

        emit FundAddedToRegistry(fundAddress);
    }

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function getFundsCount() external view returns (uint256) {
        return _funds.length();
    }

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function listFunds() external view returns (address[] memory) {
        return _funds.values();
    }

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function removeFund(address fundAddress) external onlyOwner {
        if (!_funds.contains(fundAddress)) revert InvestmentFundRegistry__InvestmentFundNotAdded();
        if (!_funds.remove(fundAddress)) revert InvestmentFundRegistry__InvestmentFundRemoveFailed();

        emit FundRemovedFromRegistry(fundAddress);
    }

    uint256[49] private __gap;
}
