// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./interfaces/IInvestmentFundRegistry.sol";

/**
 * @title Investment fund registry contract
 */
contract InvestmentFundRegistry is IInvestmentFundRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private _funds;

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function addFund(address fundAddress) external {
        // TODO limit roles access
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
    function removeFund(address fundAddress) external {
        // TODO limit roles access
        emit FundRemovedFromRegistry(fundAddress);

        require(_funds.remove(fundAddress), "Removing fund from registry failed");
    }
}
