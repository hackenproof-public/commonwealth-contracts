// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {EnumerableMapUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {IDexQuoter} from "./interfaces/IDexQuoter.sol";
import {IInvestmentFund} from "./interfaces/IInvestmentFund.sol";
import {IInvestmentNFT} from "./interfaces/IInvestmentNFT.sol";
import {IStakingWlth} from "./interfaces/IStakingWlth.sol";
import {IStateMachine} from "./interfaces/IStateMachine.sol";
import {LibFund} from "./libraries/LibFund.sol";
import {BASIS_POINT_DIVISOR} from "./libraries/Constants.sol";
import {_transferFrom} from "./libraries/Utils.sol";

/**
 * @title Staking WLTH contract
 */
contract StakingWlth is OwnablePausable, IStakingWlth {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.UintToUintMap;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public token;
    address public usdc;
    uint256 public transactionFee;
    address public treasury;
    uint256 public maxDiscount;
    IDexQuoter public dexQuoter;
    mapping(uint256 => StakingDetails) public stakingDetails;
    mapping(address => mapping(address => uint256[])) public stakesPerAccount;
    CountersUpgradeable.Counter public counter;

    EnumerableMapUpgradeable.UintToUintMap private periodCoefficients;
    EnumerableSetUpgradeable.AddressSet private registeredFunds;
    EnumerableSetUpgradeable.AddressSet private stakingAccounts;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes contract
     * @param owner Contract owner
     * @param token_ Address of token to be staked
     * @param usdc_ Address of USDC token
     * @param dexQuoter_ Address of DEX quoter
     * @param fee_ Fee amount in basis points
     * @param treasuryWallet Address of fee recipient
     * @param maxDiscount_ Maximum fee discount in basis points
     * @param periods List of supported staking periods in seconds
     * @param coefficients List of staking coefficients corresponding to supported periods
     */
    function initialize(
        address owner,
        address token_,
        address usdc_,
        address dexQuoter_,
        uint256 fee_,
        address treasuryWallet,
        uint256 maxDiscount_,
        uint256[] memory periods,
        uint256[] memory coefficients
    ) public initializer {
        require(token_ != address(0), "Token is zero address");
        require(usdc_ != address(0), "USDC token is zero address");
        require(dexQuoter_ != address(0), "DEX quoter is zero address");
        require(treasuryWallet != address(0), "Treasury is zero address");
        require(periods.length == coefficients.length, "Periods and coefficients lengths mismatch");

        __Context_init();
        __OwnablePausable_init(owner);

        token = token_;
        usdc = usdc_;
        dexQuoter = IDexQuoter(dexQuoter_);
        transactionFee = fee_;
        treasury = treasuryWallet;
        maxDiscount = maxDiscount_;

        for (uint256 i = 0; i < periods.length; i++) {
            periodCoefficients.set(periods[i], coefficients[i]);
        }
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function stake(address fund, uint256 amount, uint256 period) external {
        require(registeredFunds.contains(fund), "Fund is not registered");
        require(amount > 0, "Invalid staking amount");
        require(periodCoefficients.contains(period), "Invalid staking period");

        uint256 currentDiscount = _getTotalTargetDiscount(_msgSender(), fund);
        (uint256 amountInUsdc, , , ) = dexQuoter.quote(token, usdc, amount);
        uint256 targetDiscount = _calculateTargetDiscount(_msgSender(), fund, amountInUsdc, period);

        require(targetDiscount > 0, "Target discount is equal to zero");
        require(currentDiscount + targetDiscount <= maxDiscount, "Target discount exceeds maximum value");

        uint256 stakeId = counter.current();
        counter.increment();

        DiscountDistribution memory dist = _createDiscountDistribution(fund, block.timestamp, period, targetDiscount);
        stakingDetails[stakeId] = StakingDetails(_msgSender(), fund, uint128(amount), uint128(amountInUsdc), dist);
        stakesPerAccount[_msgSender()][fund].push(stakeId);
        stakingAccounts.add(_msgSender());

        emit TokensStaked(_msgSender(), fund, stakeId, amount);

        uint256 fee = MathUpgradeable.mulDiv(amount, transactionFee, BASIS_POINT_DIVISOR);
        if (fee > 0) {
            _transferFrom(token, _msgSender(), treasury, fee);
        }
        _transferFrom(token, _msgSender(), address(this), amount - fee);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function unstake(uint256 stakeId) external {
        revert("Not implemented");
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getStakingAccounts() external view returns (address[] memory) {
        return stakingAccounts.values();
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function registerFund(address fund) external onlyOwner {
        require(registeredFunds.add(fund), "Fund already registered");

        emit FundRegistered(_msgSender(), fund);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function unregisterFund(address fund) external onlyOwner {
        require(registeredFunds.remove(fund), "Fund is not registered");

        emit FundUnregistered(_msgSender(), fund);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getRegisteredFunds() external view returns (address[] memory) {
        return registeredFunds.values();
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getDiscount(address account, address fund) external view returns (uint256) {
        require(registeredFunds.contains(fund), "Fund is not registered");

        return _getDiscountForAccount(account, fund, block.timestamp);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getDiscountInTimestamp(address account, address fund, uint256 timestamp) external view returns (uint256) {
        require(registeredFunds.contains(fund), "Fund is not registered");

        return _getDiscountForAccount(account, fund, timestamp);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getEstimatedDiscount(
        address account,
        address fund,
        uint256 amountInUsdc,
        uint256 start,
        uint256 period,
        uint256 timestamp
    ) external view returns (uint256) {
        require(registeredFunds.contains(fund), "Fund is not registered");

        return _getEstimatedDiscount(account, fund, amountInUsdc, start, period, timestamp);
    }

    function _createDiscountDistribution(
        address fund,
        uint256 start,
        uint256 period,
        uint256 targetDiscount
    ) private view returns (DiscountDistribution memory) {
        bytes32 fundState = IStateMachine(fund).currentState();
        bool isConstant = (fundState == LibFund.STATE_FUNDS_IN || fundState == LibFund.STATE_CAP_REACHED);

        return DiscountDistribution(uint64(start), uint64(start + period), uint120(targetDiscount), isConstant);
    }

    function _getEstimatedDiscount(
        address account,
        address fund,
        uint256 amountInUsdc,
        uint256 start,
        uint256 period,
        uint256 timestamp
    ) private view returns (uint256) {
        uint256 currentDiscount = _getDiscountForStakes(stakesPerAccount[account][fund], timestamp);
        uint256 newTargetDiscount = _calculateTargetDiscount(_msgSender(), fund, amountInUsdc, period);

        bytes32 fundState = IStateMachine(fund).currentState();
        bool isConstant = (fundState == LibFund.STATE_FUNDS_IN || fundState == LibFund.STATE_CAP_REACHED);

        DiscountDistribution memory dist = DiscountDistribution(
            uint64(start),
            uint64(start + period),
            uint120(newTargetDiscount),
            isConstant
        );
        uint256 discountFromNewStake = _getDiscountFromDist(dist, timestamp);

        return currentDiscount + discountFromNewStake;
    }

    function _getDiscountForStakes(uint256[] memory stakeIds, uint256 timestamp) private view returns (uint256) {
        uint256 totalDiscount = 0;
        for (uint256 i = 0; i < stakeIds.length; i++) {
            totalDiscount += _getDiscountFromDist(stakingDetails[stakeIds[i]].discount, timestamp);
        }
        return MathUpgradeable.min(totalDiscount, maxDiscount);
    }

    function _getDiscountForAccount(address account, address fund, uint256 timestamp) private view returns (uint256) {
        return _getDiscountForStakes(stakesPerAccount[account][fund], timestamp);
    }

    function _getDiscountFromDist(DiscountDistribution memory dist, uint256 timestamp) private pure returns (uint256) {
        if (timestamp < dist.start) {
            return 0;
        } else if (timestamp >= dist.end) {
            return dist.value;
        } else {
            if (dist.isConstant) {
                return dist.value;
            } else {
                uint256 periodInSeconds = dist.end - dist.start;
                uint256 elapsedSeconds = timestamp - dist.start;
                return MathUpgradeable.mulDiv(dist.value, elapsedSeconds, periodInSeconds);
            }
        }
    }

    function _getTotalTargetDiscount(address account, address fund) private view returns (uint256) {
        uint256 discount = 0;
        uint256[] memory stakes = stakesPerAccount[account][fund];
        for (uint256 i = 0; i < stakes.length; i++) {
            discount += stakingDetails[stakes[i]].discount.value;
        }
        return discount;
    }

    function _calculateTargetDiscount(
        address account,
        address fund,
        uint256 amountInUsdc,
        uint256 period
    ) private view returns (uint256) {
        address nft = IInvestmentFund(fund).investmentNft();
        uint256 investment = IInvestmentNFT(nft).getInvestmentValue(account);
        uint256 amountForMaxDiscount = MathUpgradeable.mulDiv(
            investment,
            periodCoefficients.get(period),
            BASIS_POINT_DIVISOR
        );
        return MathUpgradeable.mulDiv(amountInUsdc, maxDiscount, amountForMaxDiscount);
    }

    uint256[38] private __gap;
}
