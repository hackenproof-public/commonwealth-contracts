// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {IInvestmentFundRegistry} from "./interfaces/IInvestmentFundRegistry.sol";

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
        require(owner != address(0), "Owner is zero address");

        __Context_init();
        __Ownable_init();

        _transferOwnership(owner);
    }

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function addFund(address fundAddress) external onlyOwner {
        require(fundAddress != address(0), "Invalid fund address");

        emit FundAddedToRegistry(fundAddress);

        require(_funds.add(fundAddress), "Adding fund to registry failed");
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
        emit FundRemovedFromRegistry(fundAddress);

        require(_funds.remove(fundAddress), "Removing fund from registry failed");
    }

    uint256[49] private __gap;
}
