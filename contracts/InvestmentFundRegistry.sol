// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./interfaces/IInvestmentFundRegistry.sol";
import "./InvestmentFund.sol";

/**
 * @title Investment fund registry contract
 */
contract InvestmentFundRegistry is IInvestmentFundRegistry {
    struct FundEnumeration {
        uint248 index;
        bool exists;
    }

    address[] public funds;
    mapping(address => FundEnumeration) private _fundsEnum; // maps fund address to enumeration data

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function addFund(address fundAddress) external {
        // TODO limit roles access
        require(fundAddress != address(0), "Invalid fund address");
        require(
            IERC165(fundAddress).supportsInterface(type(IInvestmentFund).interfaceId),
            "Required interface not supported"
        );
        require(_fundsEnum[fundAddress].exists == false, "Fund already added to registry");

        emit FundAddedToRegistry(fundAddress);

        _addFundToEnumeration(fundAddress);
    }

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function getFundsCount() external view returns (uint256) {
        return funds.length;
    }

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function listFunds() external view returns (address[] memory) {
        return funds;
    }

    /**
     * @inheritdoc IInvestmentFundRegistry
     */
    function removeFund(address fundAddress) external {
        // TODO limit roles access
        FundEnumeration memory fund = _fundsEnum[fundAddress];
        require(fund.exists, "Investment fund does not exist");

        emit FundRemovedFromRegistry(fundAddress);

        _removeFundFromEnumeration(funds[fund.index]);
    }

    function _addFundToEnumeration(address fundAddress) private {
        _fundsEnum[fundAddress] = FundEnumeration(uint248(funds.length), true);
        funds.push(fundAddress);
    }

    function _removeFundFromEnumeration(address fundAddress) private {
        uint248 fundIndex = _fundsEnum[fundAddress].index;
        uint256 lastFundIndex = funds.length - 1;

        address lastFundAddress = funds[lastFundIndex];
        _fundsEnum[lastFundAddress] = FundEnumeration(fundIndex, true);
        funds[fundIndex] = funds[lastFundIndex];

        delete _fundsEnum[fundAddress];
        funds.pop();
    }
}
