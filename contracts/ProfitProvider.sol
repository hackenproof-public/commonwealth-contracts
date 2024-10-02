// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInvestmentFund} from "./interfaces/IInvestmentFund.sol";
import {IProfitProvider} from "./interfaces/IProfitProvider.sol";
import {IStateMachine} from "./interfaces/IStateMachine.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {LibFund} from "./libraries/LibFund.sol";

error ProfitProvider__OwnerAccountZeroAddress();
error ProfitProvider__CurrencyZeroAddress();
error ProfitProvider__UpkeepNotNeeded(uint256 balance, bytes32 fundState);

contract ProfitProvider is IProfitProvider, AutomationCompatibleInterface, Ownable2StepUpgradeable {
    using SafeERC20 for IERC20;

    /**
     * @dev Investment fund to provide profit to.
     */
    IInvestmentFund private s_fund;

    /**
     * @dev Currency to provide profit in.
     */
    IERC20 private s_currency;

    /**
     * @dev Minimum profit to provide.
     */
    uint256 private s_minimumProfit;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        IInvestmentFund _fund,
        IERC20 _currency,
        uint256 _minimumProfit
    ) public initializer {
        if (_owner == address(0)) {
            revert ProfitProvider__OwnerAccountZeroAddress();
        }
        if (address(_currency) == address(0)) {
            revert ProfitProvider__CurrencyZeroAddress();
        }
        __Ownable2Step_init();
        _transferOwnership(_owner);

        s_fund = _fund;
        s_currency = _currency;
        s_minimumProfit = _minimumProfit;
    }

    /**
     * @inheritdoc AutomationCompatibleInterface
     */
    function performUpkeep(bytes calldata /* performData */) external override {
        uint256 currentBalance = s_currency.balanceOf(address(this));
        if (
            currentBalance < s_minimumProfit ||
            IStateMachine(address(s_fund)).currentState() != LibFund.STATE_FUNDS_DEPLOYED
        ) {
            revert ProfitProvider__UpkeepNotNeeded(currentBalance, IStateMachine(address(s_fund)).currentState());
        }
        s_currency.safeIncreaseAllowance(address(s_fund), currentBalance);
        s_fund.provideProfit(currentBalance, true);

        emit ProfitProvided(currentBalance);
    }

    /**
     * @inheritdoc IProfitProvider
     */
    function setMinimumProfit(uint256 _minimumProfit) external override onlyOwner {
        s_minimumProfit = _minimumProfit;

        emit MinimumProfitSet(_minimumProfit);
    }

    /**
     * @inheritdoc AutomationCompatibleInterface
     */
    function checkUpkeep(
        bytes calldata /* checkData */
    ) external view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        upkeepNeeded =
            IStateMachine(address(s_fund)).currentState() == LibFund.STATE_FUNDS_DEPLOYED &&
            s_currency.balanceOf(address(this)) > s_minimumProfit;
    }

    /**
     * @inheritdoc IProfitProvider
     */
    function fund() external view override returns (address) {
        return address(s_fund);
    }

    /**
     * @inheritdoc IProfitProvider
     */
    function currency() external view override returns (address) {
        return address(s_currency);
    }

    /**
     * @inheritdoc IProfitProvider
     */
    function minimumProfit() external view override returns (uint256) {
        return s_minimumProfit;
    }
}
