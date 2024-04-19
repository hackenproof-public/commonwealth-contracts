// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {EnumerableMapUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {IDexQuoter} from "./interfaces/IDexQuoter.sol";
import {IInvestmentFund} from "./interfaces/IInvestmentFund.sol";
import {IInvestmentNFT} from "./interfaces/IInvestmentNFT.sol";
import {IStakingWlth} from "./interfaces/IStakingWlth.sol";
import {IStateMachine} from "./interfaces/IStateMachine.sol";
import {IWlth} from "./interfaces/IWlth.sol";
import {LibFund} from "./libraries/LibFund.sol";
import {BASIS_POINT_DIVISOR, EXTRA_EIGHTEEN_ZEROS} from "./libraries/Constants.sol";

error StakingWlth__TokenZeroAddress();
error StakingWlth__UsdcTokenZeroAddress();
error StakingWlth__DexQuoterZeroAddress();
error StakingWlth__CommunityFundZeroAddress();
error StakingWlth__DurationsCoeffecientsLenghtsMismatch();
error StakingWlth__DurationCoeffecientsSetError();
error StakingWlth__InvestmentFundNotRegistered();
error StakingWlth__InvalidStakingAmount();
error StakingWlth__InvalidStakingDuration();
error StakingWlth__ZeroTargetDiscount();
error StakingWlth__TargetDiscountAboveMaxValue();
error StakingWlth__InvestmentFundAlreadyRegistered();
error StakingWlth__InvestmentValueTooLow();
error StakingWlth__NoTokensAvaiableToUnstake();
error StakingWlth__UnstakeExceedsStake();

/**
 * @title Staking WLTH contract
 */
contract StakingWlth is OwnablePausable, IStakingWlth, ReentrancyGuardUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.UintToUintMap;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public constant MAX_UNSTAKING_PENALTY = 8000; // percentage in basis points

    address public token;
    address public usdc;
    uint256 public transactionFee;
    address public treasury;
    address public communityFund;
    uint256 public maxDiscount;
    IDexQuoter public dexQuoter;
    CountersUpgradeable.Counter public counter;

    mapping(uint256 => Position) private stakingPositions;
    mapping(address => mapping(address => uint256[])) private stakesPerAccount;
    EnumerableMapUpgradeable.UintToUintMap private durationCoefficients;
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
     * @param maxDiscount_ Maximum fee discount in basis points
     * @param durations List of supported staking durations in seconds
     * @param coefficients List of staking coefficients corresponding to supported durations
     */
    function initialize(
        address owner,
        address token_,
        address usdc_,
        address dexQuoter_,
        uint256 fee_,
        address communityFund_,
        uint256 maxDiscount_,
        uint256[] memory durations,
        uint256[] memory coefficients
    ) public initializer {
        if (token_ == address(0)) revert StakingWlth__TokenZeroAddress();
        if (usdc_ == address(0)) revert StakingWlth__UsdcTokenZeroAddress();
        if (dexQuoter_ == address(0)) revert StakingWlth__DexQuoterZeroAddress();
        if (communityFund_ == address(0)) revert StakingWlth__CommunityFundZeroAddress();
        if (durations.length != coefficients.length) revert StakingWlth__DurationsCoeffecientsLenghtsMismatch();

        __Context_init();
        __OwnablePausable_init(owner);
        __ReentrancyGuard_init();

        token = token_;
        usdc = usdc_;
        dexQuoter = IDexQuoter(dexQuoter_);
        transactionFee = fee_;
        communityFund = communityFund_;
        maxDiscount = maxDiscount_;

        for (uint256 i; i < durations.length; ) {
            if (!durationCoefficients.set(durations[i], coefficients[i]))
                revert StakingWlth__DurationCoeffecientsSetError();
            unchecked {
                i++;
            }
        }
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function stake(address fund, uint256 amount, uint256 duration) external nonReentrant {
        //slither-disable-start reentrancy-no-eth
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();
        if (amount <= 0) revert StakingWlth__InvalidStakingAmount();
        if (!durationCoefficients.contains(duration)) revert StakingWlth__InvalidStakingDuration();

        uint256 investment = _getCurrentInvestment(_msgSender(), fund);
        uint256 totalTargetDiscount = _getTotalTargetDiscount(_msgSender(), fund);

        (uint256 amountInUsdc, , , ) = dexQuoter.quote(token, usdc, amount);
        uint256 discountFromStake = _calculateTargetDiscount(amountInUsdc, duration, investment) / EXTRA_EIGHTEEN_ZEROS;

        if (discountFromStake <= 0) revert StakingWlth__ZeroTargetDiscount();
        if (totalTargetDiscount + discountFromStake > maxDiscount) revert StakingWlth__TargetDiscountAboveMaxValue();

        Period memory period = Period(uint128(block.timestamp), uint128(duration));
        uint256 stakeId = _createStakingPosition(_msgSender(), fund, amount, amountInUsdc, investment, period);

        stakesPerAccount[_msgSender()][fund].push(stakeId);
        stakingAccounts.add(_msgSender());

        uint256 fee = Math.mulDiv(amount, transactionFee, BASIS_POINT_DIVISOR);
        amount -= fee;

        if (fee > 0) {
            IERC20Upgradeable(token).safeTransferFrom(_msgSender(), communityFund, fee);
        }
        IERC20Upgradeable(token).safeTransferFrom(_msgSender(), address(this), amount);

        emit TokensStaked(_msgSender(), fund, stakeId, amount + fee);
        //slither-disable-end reentrancy-no-eth
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function unstake(address fund, uint256 amount) external nonReentrant {
        _validateUnstake(_msgSender(), fund, amount);

        uint256 penalty;
        uint256 amountToUnstake = amount;

        if (_isFundInCRP(fund)) {
            _unstakeFromAllPositions(_msgSender(), fund, amountToUnstake);
        } else {
            uint256 unstaked = _unstakeEnded(_msgSender(), fund, amountToUnstake);
            if (unstaked < amountToUnstake) {
                amountToUnstake -= unstaked;

                unstaked = _unstakeUnlocked(_msgSender(), fund, amountToUnstake);
                if (unstaked < amountToUnstake) {
                    amountToUnstake -= unstaked;

                    (, penalty) = _unstakeLocked(_msgSender(), fund, amountToUnstake);
                }
            }
        }

        uint256 fee = Math.mulDiv(((amount - penalty) * 99) / 100, transactionFee, BASIS_POINT_DIVISOR);

        if (penalty > 0) {
            IWlth(token).burn((((penalty * 99) / 100) * 99) / 100);
            IERC20Upgradeable(token).safeTransfer(communityFund, ((penalty * 99) / 100) / 100);
        }

        if (fee > 0) {
            IERC20Upgradeable(token).safeTransfer(communityFund, fee);
        }

        emit TokensUnstaked(_msgSender(), fund, amount);

        IERC20Upgradeable(token).safeTransfer(_msgSender(), (amount * 99) / 100 - fee - (penalty * 99) / 100);
    }

    function getUnstakeSimulation(address fund, uint256 amountToUnstake) external view returns (uint256, uint256) {
        _validateUnstake(_msgSender(), fund, amountToUnstake);
        uint256 penalty;
        uint256 totalStake;
        uint256[] memory stakeIds = stakesPerAccount[_msgSender()][fund];
        uint256 stakingPositionsAmount = stakeIds.length;

        Position[] memory stakingPositionsBuffer = new Position[](stakingPositionsAmount);

        for (uint256 i; i < stakingPositionsAmount; ) {
            Position memory pos = stakingPositions[stakeIds[i]];
            stakingPositionsBuffer[i] = pos;
            totalStake += pos.amountInWlth;
            unchecked {
                i++;
            }
        }

        if (_isFundInCRP(fund)) {
            _unstakeFromAllPositionsSimulation(
                _msgSender(),
                fund,
                amountToUnstake,
                stakingPositionsBuffer,
                stakingPositionsAmount
            );
        } else {
            uint256 unstaked = _unstakeEndedSimulation(
                amountToUnstake,
                stakingPositionsBuffer,
                stakeIds,
                stakingPositionsAmount
            );
            if (unstaked < amountToUnstake) {
                amountToUnstake -= unstaked;
                unstaked = _unstakeUnlockedSimulation(
                    amountToUnstake,
                    stakingPositionsBuffer,
                    stakeIds,
                    stakingPositionsAmount,
                    _msgSender(),
                    fund
                );
                if (unstaked < amountToUnstake) {
                    amountToUnstake -= unstaked;
                    (, penalty) = _unstakeLockedSimulation(
                        amountToUnstake,
                        stakingPositionsBuffer,
                        stakeIds,
                        stakingPositionsAmount
                    );
                }
            }
        }

        uint256 currentInvestment = _getCurrentInvestment(_msgSender(), fund);
        uint256 discountAfterSimulation = _getDiscountForBuffer(
            stakingPositionsBuffer,
            stakingPositionsAmount,
            currentInvestment,
            block.timestamp
        );

        return (penalty, discountAfterSimulation);
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
    function getStakingPositionsInFund(address account, address fund) external view returns (uint256[] memory) {
        return stakesPerAccount[account][fund];
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getPositionDetails(uint256 position) external view returns (Position memory) {
        return stakingPositions[position];
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function registerFund(address fund) external onlyOwner {
        if (!registeredFunds.add(fund)) revert StakingWlth__InvestmentFundAlreadyRegistered();

        emit FundRegistered(_msgSender(), fund);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function unregisterFund(address fund) external onlyOwner {
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();
        registeredFunds.remove(fund);

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
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();
        uint256 investmentSize = _getCurrentInvestment(account, fund);

        return Math.min(_getDiscountForAccount(account, fund, block.timestamp, investmentSize), maxDiscount);
    }

    function getDiscountFromPreviousInvestmentInTimestamp(
        address account,
        address fund,
        uint256 timestamp,
        uint256 blocknumber
    ) external view returns (uint256) {
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();
        uint256 investmentSize = _getInvestmentInBlock(account, fund, blocknumber);

        return Math.min(_getDiscountForAccount(account, fund, timestamp, investmentSize), maxDiscount);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getDiscountInTimestamp(address account, address fund, uint256 timestamp) external view returns (uint256) {
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();
        uint256 investmentSize = _getCurrentInvestment(account, fund);

        return Math.min(_getDiscountForAccount(account, fund, timestamp, investmentSize), maxDiscount);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getEstimatedDiscount(
        address account,
        address fund,
        uint256 amountInUsdc,
        Period memory period,
        uint256 timestamp
    ) external view returns (uint256) {
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();

        return _getEstimatedDiscount(account, fund, amountInUsdc, period, timestamp);
    }

    function getPenalty(address account, address fund, uint256 amount) external view returns (uint256) {
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();

        if (!_isFundInCRP(fund)) {
            uint256 totalReleased = _getEndedTokensCount(account, fund) + _getUnlockedTokensCount(account, fund);
            if (amount > totalReleased) {
                return _getPenaltyFromLocked(account, fund, amount - totalReleased);
            }
        }
        return 0;
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getStakedTokensInFund(address account, address fund) public view returns (uint256) {
        Position[] memory positions = _getPositions(account, fund);
        (uint256 totalStaked, , ) = _getStakedTokensFromPositions(positions);
        return totalStaked;
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getStakedTokens(address account) external view returns (uint256) {
        uint256 tokens = 0;
        address[] memory funds = registeredFunds.values();
        for (uint256 i = 0; i < funds.length; i++) {
            tokens += getStakedTokensInFund(account, funds[i]);
        }
        return tokens;
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getReleasedTokens(address account, address fund) external view returns (uint256) {
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();

        return _getEndedTokensCount(account, fund) + _getUnlockedTokensCount(account, fund);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getReleasedTokensFromEndedPositions(address account, address fund) external view returns (uint256) {
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();

        return _getEndedTokensCount(account, fund);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getReleasedTokensFromOpenPositions(address account, address fund) external view returns (uint256) {
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();

        return _getUnlockedTokensCount(account, fund);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getTotalStakingPeriod(address account, address fund) external view returns (Period memory) {
        uint256 begin;
        uint256 end;
        Position[] memory positions = _getNonEmptyPositions(account, fund);
        for (uint256 i; i < positions.length; ) {
            Period memory period = positions[i].period;
            begin = begin > 0 ? Math.min(begin, period.start) : period.start;
            end = Math.max(end, period.start + period.duration);
            unchecked {
                i++;
            }
        }
        return Period(uint128(begin), uint128(end - begin));
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getRequiredStakeForMaxDiscount(
        address account,
        address fund,
        uint256 duration
    ) external view returns (uint256) {
        uint256 targetDiscount = _getTotalTargetDiscount(account, fund);
        if (targetDiscount < maxDiscount) {
            if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();

            uint256 usdcForMaxDiscount = _getStakeForMaxDiscountInUsdc(_getCurrentInvestment(account, fund), duration);
            if (usdcForMaxDiscount <= 0) revert StakingWlth__InvestmentValueTooLow();

            uint256 remainingDiscount = maxDiscount - targetDiscount;
            return Math.mulDiv(usdcForMaxDiscount, remainingDiscount, maxDiscount);
        }
        return 0;
    }

    function _createStakingPosition(
        address staker,
        address fund,
        uint256 amountInWlth,
        uint256 amountInUsdc,
        uint256 investment,
        Period memory period
    ) private returns (uint256) {
        uint256 id = counter.current();
        counter.increment();

        stakingPositions[id] = Position(
            id,
            staker,
            fund,
            uint128(amountInWlth),
            uint128(amountInUsdc),
            investment,
            period,
            _isFundInCRP(fund),
            0
        );
        return id;
    }

    function _getEndedTokensCount(address account, address fund) private view returns (uint256) {
        uint256 ended;
        Position[] memory endedPositions = _getFilteredPositions(account, fund, _isPositionEnded);
        for (uint256 i; i < endedPositions.length; ) {
            Position memory pos = endedPositions[i];
            if (_isPositionEnded(pos)) {
                ended += (pos.amountInWlth - pos.unstakedEnded);
            }
            unchecked {
                i++;
            }
        }
        return ended;
    }

    function _getUnlockedTokensCount(address account, address fund) private view returns (uint256) {
        (uint256 unlocked, , ) = _getUnlockedTokens(account, fund);
        return unlocked;
    }

    function _unstakeFromAllPositions(address account, address fund, uint256 amount) private returns (uint256) {
        (uint256[] memory ids, uint256[] memory staked) = _getStakedTokensFromNonEmptyPositions(account, fund);
        (uint256 totalCount, uint256[] memory amountsToUnstake) = _getTokensToUnstake(amount, ids, staked);
        _unstake(ids, amountsToUnstake);
        return totalCount;
    }

    function _unstakeFromAllPositionsSimulation(
        address account,
        address fund,
        uint256 amount,
        Position[] memory stakingPositionsBuffer,
        uint256 stakingPositionsAmount
    ) private view returns (uint256) {
        (uint256[] memory ids, uint256[] memory staked) = _getStakedTokensFromNonEmptyPositions(account, fund);
        (uint256 totalCount, uint256[] memory amountsToUnstake) = _getTokensToUnstake(amount, ids, staked);
        _unstakeBuffer(ids, amountsToUnstake, stakingPositionsBuffer, stakingPositionsAmount);
        return totalCount;
    }

    function _unstakeEnded(address account, address fund, uint256 amount) private returns (uint256) {
        uint256 remainingAmount = amount;
        Position[] memory endedPosistions = _getFilteredPositions(account, fund, _isPositionEnded);
        for (uint256 i; i < endedPosistions.length && remainingAmount > 0; ) {
            Position memory pos = endedPosistions[i];
            uint256 toUnstake = Math.min(amount, pos.amountInWlth - pos.unstakedEnded);
            stakingPositions[pos.id].unstakedEnded += toUnstake;
            remainingAmount -= toUnstake;
            unchecked {
                i++;
            }
        }
        return (amount - remainingAmount);
    }

    function _unstakeEndedSimulation(
        uint256 amount,
        Position[] memory stakingPositionsBuffer,
        uint256[] memory stakeIds,
        uint256 stakingPositionsBufferAmount
    ) private view returns (uint256) {
        uint256 remainingAmount = amount;
        Position[] memory endedPosistions = _getFilteredBufferPositions(
            stakingPositionsBuffer,
            stakeIds,
            _isPositionEnded
        );
        for (uint256 i; i < endedPosistions.length && remainingAmount > 0; ) {
            Position memory pos = endedPosistions[i];
            uint256 toUnstake = Math.min(remainingAmount, pos.amountInWlth - pos.unstakedEnded);
            for (uint j; j < stakingPositionsBufferAmount; ) {
                if (stakingPositionsBuffer[j].id == pos.id) {
                    stakingPositionsBuffer[j].unstakedEnded += toUnstake;
                    break;
                }
                unchecked {
                    j++;
                }
            }
            remainingAmount -= toUnstake;
            unchecked {
                i++;
            }
        }
        return (amount - remainingAmount);
    }

    function _unstakeUnlocked(address account, address fund, uint256 amount) private returns (uint256) {
        (uint256 totalCount, uint256[] memory ids, uint256[] memory counts) = _getUnlockedTokens(account, fund);

        uint256 toUnstake = Math.min(amount, totalCount);
        (uint256 totalToUnstake, uint256[] memory amountsToUnstake) = _getTokensToUnstake(toUnstake, ids, counts);
        _unstake(ids, amountsToUnstake);

        return totalToUnstake;
    }

    function _unstakeUnlockedSimulation(
        uint256 amount,
        Position[] memory stakingPositionsBuffer,
        uint256[] memory stakeIds,
        uint256 stakingPositionsBufferAmount,
        address account,
        address fund
    ) private view returns (uint256) {
        uint256 investmentSize = _getCurrentInvestment(account, fund);
        (uint256 totalCount, uint256[] memory ids, uint256[] memory counts) = _getUnlockedBufferedTokens(
            stakingPositionsBuffer,
            stakeIds,
            investmentSize
        );

        uint256 toUnstake = Math.min(amount, totalCount);
        (uint256 totalToUnstake, uint256[] memory amountsToUnstake) = _getTokensToUnstake(toUnstake, ids, counts);
        _unstakeBuffer(ids, amountsToUnstake, stakingPositionsBuffer, stakingPositionsBufferAmount);

        return totalToUnstake;
    }

    function _unstakeLocked(address account, address fund, uint256 amount) private returns (uint256, uint256) {
        Position[] memory openPositions = _getOpenPositions(account, fund);
        (uint256 totalCount, uint256[] memory ids, uint256[] memory counts) = _getStakedTokensFromPositions(
            openPositions
        );

        uint256 toUnstake = Math.min(amount, totalCount);
        (, uint256[] memory amountsToUnstake) = _getTokensToUnstake(toUnstake, ids, counts);
        (uint256 totalUnstaked, uint256 totalPenalty) = _unstakeWithPenalty(ids, amountsToUnstake);

        return (totalUnstaked, totalPenalty);
    }

    function _unstakeLockedSimulation(
        uint256 amount,
        Position[] memory stakingPositionsBuffer,
        uint256[] memory stakeIds,
        uint256 stakingPositionsAmount
    ) private view returns (uint256, uint256) {
        Position[] memory openPositions = _getOpenBufferedPositions(stakingPositionsBuffer, stakeIds);
        (uint256 totalCount, uint256[] memory ids, uint256[] memory counts) = _getStakedTokensFromPositions(
            openPositions
        );

        uint256 toUnstake = Math.min(amount, totalCount);
        (, uint256[] memory amountsToUnstake) = _getTokensToUnstake(toUnstake, ids, counts);
        (uint256 totalUnstaked, uint256 totalPenalty) = _unstakeWithPenaltyFromBuffer(
            ids,
            amountsToUnstake,
            stakingPositionsBuffer,
            stakingPositionsAmount
        );

        return (totalUnstaked, totalPenalty);
    }

    function _getStakedTokensFromNonEmptyPositions(
        address account,
        address fund
    ) private view returns (uint256[] memory, uint256[] memory) {
        Position[] memory positions = _getNonEmptyPositions(account, fund);
        (, uint256[] memory ids, uint256[] memory staked) = _getStakedTokensFromPositions(positions);
        return (ids, staked);
    }

    function _getStakedTokensFromPositions(
        Position[] memory positions
    ) private pure returns (uint256, uint256[] memory, uint256[] memory) {
        uint256 totalCount;
        uint256[] memory ids = new uint256[](positions.length);
        uint256[] memory staked = new uint256[](positions.length);
        for (uint256 i; i < positions.length; ) {
            Position memory pos = positions[i];
            ids[i] = pos.id;
            staked[i] = pos.amountInWlth - pos.unstakedEnded;
            totalCount += staked[i];
            unchecked {
                i++;
            }
        }
        return (totalCount, ids, staked);
    }

    function _getUnlockedTokens(
        address account,
        address fund
    ) private view returns (uint256, uint256[] memory, uint256[] memory) {
        Position[] memory openPositions = _getOpenPositions(account, fund);
        uint256 totalTargetDiscount = _getTotalTargetDiscount(account, fund);
        uint256 investmentSize = _getCurrentInvestment(account, fund);
        if (investmentSize > 0) {
            uint256 totalUnlocked;
            uint256[] memory ids = new uint256[](openPositions.length);
            uint256[] memory unlocked = new uint256[](openPositions.length);

            if (totalTargetDiscount > maxDiscount) {
                uint256 totalDiscountOfOpen = _getTotalTargetDiscountForPositions(openPositions, investmentSize);
                uint256 totalDiscountOfClosed = totalTargetDiscount - totalDiscountOfOpen;
                uint256 remainingDiscountToHandle = totalDiscountOfClosed < maxDiscount
                    ? maxDiscount - totalDiscountOfClosed
                    : 0;

                for (uint256 i; i < openPositions.length; ) {
                    Position memory pos = openPositions[i];
                    ids[i] = pos.id;

                    uint256 workingTokens = totalDiscountOfOpen > 0
                        ? Math.mulDiv(pos.amountInWlth, remainingDiscountToHandle, totalDiscountOfOpen)
                        : 0;
                    uint256 unlockedTokens = pos.amountInWlth > workingTokens
                        ? pos.amountInWlth - workingTokens
                        : pos.amountInWlth;
                    unlocked[i] = unlockedTokens;
                    totalUnlocked += unlockedTokens;
                    unchecked {
                        i++;
                    }
                }
            }
            return (totalUnlocked, ids, unlocked);
        } else {
            return _getStakedTokensFromPositions(openPositions);
        }
    }

    function _getUnlockedBufferedTokens(
        Position[] memory bufferedPositions,
        uint256[] memory stakeIds,
        uint256 investmentSize
    ) private view returns (uint256, uint256[] memory, uint256[] memory) {
        Position[] memory openPositions = _getOpenBufferedPositions(bufferedPositions, stakeIds);
        uint256 totalTargetDiscount = _getTotalTargetDiscountBuffered(bufferedPositions, stakeIds, investmentSize);
        if (investmentSize > 0) {
            uint256 totalUnlocked;
            uint256[] memory ids = new uint256[](openPositions.length);
            uint256[] memory unlocked = new uint256[](openPositions.length);

            if (totalTargetDiscount > maxDiscount) {
                uint256 totalDiscountOfOpen = _getTotalTargetDiscountForPositions(openPositions, investmentSize);
                uint256 totalDiscountOfClosed = totalTargetDiscount - totalDiscountOfOpen;
                uint256 remainingDiscountToHandle = totalDiscountOfClosed < maxDiscount
                    ? maxDiscount - totalDiscountOfClosed
                    : 0;

                for (uint256 i; i < openPositions.length; ) {
                    Position memory pos = openPositions[i];
                    ids[i] = pos.id;

                    uint256 workingTokens = totalDiscountOfOpen > 0
                        ? Math.mulDiv(pos.amountInWlth, remainingDiscountToHandle, totalDiscountOfOpen)
                        : 0;
                    uint256 unlockedTokens = pos.amountInWlth > workingTokens
                        ? pos.amountInWlth - workingTokens
                        : pos.amountInWlth;
                    unlocked[i] = unlockedTokens;
                    totalUnlocked += unlockedTokens;
                    unchecked {
                        i++;
                    }
                }
            }
            return (totalUnlocked, ids, unlocked);
        } else {
            return _getStakedTokensFromPositions(openPositions);
        }
    }

    function _getLockedTokens(
        address account,
        address fund
    ) private view returns (uint256, uint256[] memory, uint256[] memory) {
        uint256 totalLocked;
        (, uint256[] memory ids, uint256[] memory unlocked) = _getUnlockedTokens(account, fund);
        uint256[] memory locked = new uint256[](ids.length);
        Position[] memory positions = _getPositions(account, fund);
        for (uint256 i; i < unlocked.length; ) {
            locked[i] = positions[ids[i]].amountInWlth - unlocked[i];
            totalLocked += locked[i];
            unchecked {
                i++;
            }
        }
        return (totalLocked, ids, locked);
    }

    function _getTokensToUnstake(
        uint256 amount,
        uint256[] memory ids,
        uint256[] memory available
    ) private pure returns (uint256, uint256[] memory) {
        uint256[] memory amountsToUnstake = new uint256[](ids.length);
        uint256 remainingAmount = amount;
        uint256 totalToUnstake;
        uint256 numberOfPositions = ids.length;
        uint256 nonEmptyPositions;
        for (uint256 i; i < numberOfPositions; ) {
            if (available[i] > 0) {
                nonEmptyPositions++;
            }
            unchecked {
                i++;
            }
        }

        for (uint256 iter; remainingAmount > 0 && iter < numberOfPositions && nonEmptyPositions > 0; ) {
            uint256 average = remainingAmount / nonEmptyPositions;
            //slither-disable-next-line weak-prng
            uint256 remainder = remainingAmount % nonEmptyPositions;
            if (average > 0) {
                for (uint256 i; i < numberOfPositions; ) {
                    uint256 toUnstake = Math.min(average, available[i]);
                    if (toUnstake > 0) {
                        remainingAmount -= toUnstake;
                        totalToUnstake += toUnstake;
                        amountsToUnstake[i] += toUnstake;
                        available[i] -= toUnstake;
                        if (available[i] == 0) {
                            nonEmptyPositions--;
                        }
                    }
                    unchecked {
                        i++;
                    }
                }
            } else {
                for (uint256 i; remainder > 0 && i < numberOfPositions; ) {
                    uint256 toUnstake = Math.min(remainder, available[i]);
                    if (toUnstake > 0) {
                        remainder -= toUnstake;
                        remainingAmount -= toUnstake;
                        totalToUnstake += toUnstake;
                        amountsToUnstake[i] += toUnstake;
                        available[i] -= toUnstake;
                        if (available[i] == 0) {
                            nonEmptyPositions--;
                        }
                    }
                    unchecked {
                        i++;
                    }
                }
            }
            unchecked {
                iter++;
            }
        }
        if (totalToUnstake != amount) revert StakingWlth__NoTokensAvaiableToUnstake();

        return (totalToUnstake, amountsToUnstake);
    }

    function _unstake(uint256[] memory ids, uint256[] memory toUnstake) private {
        for (uint256 i; i < ids.length; ) {
            _reducePosition(ids[i], toUnstake[i]);
            unchecked {
                i++;
            }
        }
    }

    function _unstakeBuffer(
        uint256[] memory ids,
        uint256[] memory toUnstake,
        Position[] memory stakingPositionsBuffer,
        uint256 stakingPositionsBufferAmount
    ) private pure {
        for (uint256 i; i < ids.length; ) {
            _reduceBufferedPosition(ids[i], toUnstake[i], stakingPositionsBuffer, stakingPositionsBufferAmount);
            unchecked {
                i++;
            }
        }
    }

    function _unstakeWithPenalty(uint256[] memory ids, uint256[] memory toUnstake) private returns (uint256, uint256) {
        uint256 totalUnstaked;
        uint256 totalPenalty;
        for (uint256 i; i < ids.length; ) {
            Position memory pos = stakingPositions[ids[i]];
            (uint256 unstaked, uint256 penalty) = _getUnstakedAndPenalty(pos, toUnstake[i]);
            totalUnstaked += unstaked;
            totalPenalty += penalty;
            _reducePosition(ids[i], unstaked);
            unchecked {
                i++;
            }
        }
        return (totalUnstaked, totalPenalty);
    }

    function _reducePosition(uint256 id, uint256 toReduce) private {
        Position memory pos = stakingPositions[id];
        uint256 newAmount = pos.amountInWlth - toReduce;

        stakingPositions[id].amountInWlth = uint128(newAmount);
        stakingPositions[id].amountInUsdc = uint128(Math.mulDiv(pos.amountInUsdc, newAmount, pos.amountInWlth));
    }

    function _getPenaltyFromLocked(address account, address fund, uint256 amount) private view returns (uint256) {
        uint256 totalPenalty;
        (, uint256[] memory ids, uint256[] memory locked) = _getLockedTokens(account, fund);
        (, uint256[] memory amountsToUnstake) = _getTokensToUnstake(amount, ids, locked);
        Position[] memory positions = _getPositions(account, fund);
        for (uint256 i; i < amountsToUnstake.length; ) {
            (, uint256 penalty) = _getUnstakedAndPenalty(positions[ids[i]], amountsToUnstake[i]);
            totalPenalty += penalty;
            unchecked {
                i++;
            }
        }
        return totalPenalty;
    }

    function _getEstimatedDiscount(
        address account,
        address fund,
        uint256 amountInUsdc,
        Period memory period,
        uint256 timestamp
    ) private view returns (uint256) {
        uint256 investment = _getCurrentInvestment(account, fund);
        uint256 currentDiscount = _getDiscountForAccount(account, fund, timestamp, investment);

        uint256 newTargetDiscount = _calculateTargetDiscount(amountInUsdc, period.duration, investment) /
            EXTRA_EIGHTEEN_ZEROS;
        uint256 discountFromStake = _getDiscountFunction(_isFundInCRP(fund))(period, newTargetDiscount, timestamp);

        return currentDiscount + discountFromStake;
    }

    function _getDiscountForAccount(
        address account,
        address fund,
        uint256 timestamp,
        uint256 investment
    ) private view returns (uint256) {
        uint256 totalDiscount;
        uint256[] memory stakeIds = stakesPerAccount[account][fund];
        for (uint256 i; i < stakeIds.length; ) {
            totalDiscount += _getDiscountForPosition(stakingPositions[stakeIds[i]], timestamp, investment);
            unchecked {
                i++;
            }
        }
        return totalDiscount;
    }

    function _getDiscountForPosition(
        Position memory pos,
        uint256 timestamp,
        uint256 investment
    ) private view returns (uint256) {
        uint256 targetDiscount = _calculateTargetDiscount(pos.amountInUsdc, pos.period.duration, investment) /
            EXTRA_EIGHTEEN_ZEROS;
        function(Period memory, uint256, uint256) pure returns (uint256) func = _getDiscountFunction(pos.isCRP);
        return func(pos.period, targetDiscount, timestamp);
    }

    function _getTotalTargetDiscount(address account, address fund) private view returns (uint256) {
        uint256 investmentSize = _getCurrentInvestment(account, fund);
        uint256 discount;
        uint256[] memory stakes = stakesPerAccount[account][fund];
        for (uint256 i; i < stakes.length; ) {
            Position memory position = stakingPositions[stakes[i]];
            discount += _calculateTargetDiscount(position.amountInUsdc, position.period.duration, investmentSize);
            unchecked {
                i++;
            }
        }
        return discount / EXTRA_EIGHTEEN_ZEROS;
    }

    function _getTotalTargetDiscountBuffered(
        Position[] memory bufferedPositions,
        uint256[] memory stakeIds,
        uint256 investmentSize
    ) private view returns (uint256) {
        uint256 discount;
        for (uint256 i; i < stakeIds.length; ) {
            Position memory position = bufferedPositions[i];
            discount += _calculateTargetDiscount(position.amountInUsdc, position.period.duration, investmentSize);
            unchecked {
                i++;
            }
        }
        return discount / EXTRA_EIGHTEEN_ZEROS;
    }

    function _getTotalTargetDiscountForPositions(
        Position[] memory positions,
        uint256 investmentSize
    ) private view returns (uint256) {
        uint256 discount;
        for (uint256 i; i < positions.length; ) {
            Position memory position = positions[i];
            discount += _calculateTargetDiscount(position.amountInUsdc, position.period.duration, investmentSize);
            unchecked {
                i++;
            }
        }
        return discount / EXTRA_EIGHTEEN_ZEROS;
    }

    function _calculateTargetDiscount(
        uint256 amountInUsdc,
        uint256 period,
        uint256 investment
    ) private view returns (uint256) {
        uint256 amountForMaxDiscount = _getStakeForMaxDiscountInUsdc(investment, period);
        if (amountForMaxDiscount > 0) {
            return Math.mulDiv(amountInUsdc * EXTRA_EIGHTEEN_ZEROS, maxDiscount, amountForMaxDiscount);
        } else {
            return uint256(type(uint128).max);
        }
    }

    function _getStakeForMaxDiscountInUsdc(uint256 investment, uint256 stakeDuration) private view returns (uint256) {
        return Math.mulDiv(investment, durationCoefficients.get(stakeDuration), BASIS_POINT_DIVISOR);
    }

    function _getCurrentInvestment(address account, address fund) private view returns (uint256) {
        address nft = IInvestmentFund(fund).investmentNft();
        return IInvestmentNFT(nft).getInvestmentValue(account);
    }

    function _getInvestmentInBlock(address account, address fund, uint256 blockNumber) private view returns (uint256) {
        address nft = IInvestmentFund(fund).investmentNft();
        return IInvestmentNFT(nft).getPastInvestmentValue(account, blockNumber);
    }

    function _isFundInCRP(address fund) private view returns (bool) {
        bytes32 fundState = IStateMachine(fund).currentState();
        return fundState == LibFund.STATE_FUNDS_IN || fundState == LibFund.STATE_CAP_REACHED;
    }

    function _validateUnstake(address staker, address fund, uint256 amount) private view {
        if (!registeredFunds.contains(fund)) revert StakingWlth__InvestmentFundNotRegistered();

        uint256 totalStake;
        uint256[] memory stakeIds = stakesPerAccount[staker][fund];
        for (uint256 i; i < stakeIds.length; ) {
            Position memory pos = stakingPositions[stakeIds[i]];
            totalStake += pos.amountInWlth;
            unchecked {
                i++;
            }
        }
        if (totalStake < amount) revert StakingWlth__UnstakeExceedsStake();
    }

    function _getUnstakedAndPenalty(Position memory pos, uint256 amount) private view returns (uint256, uint256) {
        uint256 toUnstake = Math.min(amount, pos.amountInWlth);

        uint256 end = pos.period.start + pos.period.duration;
        uint256 maxPenalty = Math.mulDiv(toUnstake, MAX_UNSTAKING_PENALTY, BASIS_POINT_DIVISOR);
        uint256 penalty = _isPositionActive(pos)
            ? Math.mulDiv(maxPenalty, end - block.timestamp, pos.period.duration)
            : 0;

        return (toUnstake, penalty);
    }

    function _constantFunction(
        Period memory period,
        uint256 discount,
        uint256 timestamp
    ) private pure returns (uint256) {
        if (timestamp < period.start) {
            return 0;
        } else {
            return discount;
        }
    }

    function _linearFunction(Period memory period, uint256 discount, uint256 timestamp) private pure returns (uint256) {
        if (timestamp < period.start) {
            return 0;
        } else {
            if (timestamp >= period.start + period.duration) {
                return discount;
            } else {
                uint256 elapsedSeconds = timestamp - period.start;
                return Math.mulDiv(discount, elapsedSeconds, period.duration);
            }
        }
    }

    function _getDiscountFunction(
        bool isCRP
    ) private pure returns (function(Period memory, uint256, uint256) pure returns (uint256)) {
        return isCRP ? _constantFunction : _linearFunction;
    }

    function _isPositionStarted(Position memory position) private view returns (bool) {
        return (block.timestamp >= position.period.start);
    }

    function _isPositionEnded(Position memory position) private view returns (bool) {
        return (block.timestamp > position.period.start + position.period.duration);
    }

    function _isPositionActive(Position memory position) private view returns (bool) {
        return _isPositionStarted(position) && !_isPositionEnded(position);
    }

    function _isPositionOpen(Position memory position) private view returns (bool) {
        return _isPositionNonEmpty(position) && _isPositionActive(position);
    }

    function _isPositionNonEmpty(Position memory position) private pure returns (bool) {
        return position.amountInWlth > 0;
    }

    function _getPositions(address account, address fund) private view returns (Position[] memory) {
        uint256[] memory stakeIds = stakesPerAccount[account][fund];
        Position[] memory positions = new Position[](stakeIds.length);
        for (uint256 i; i < stakeIds.length; ) {
            positions[i] = stakingPositions[stakeIds[i]];
            unchecked {
                i++;
            }
        }
        return positions;
    }

    function _getFilteredPositions(
        address account,
        address fund,
        function(Position memory) view returns (bool) pred
    ) private view returns (Position[] memory) {
        uint256[] memory stakeIds = stakesPerAccount[account][fund];
        Position[] memory positions = new Position[](stakeIds.length);
        uint256 count;
        for (uint256 i; i < stakeIds.length; ) {
            Position memory pos = stakingPositions[stakeIds[i]];
            if (pred(pos)) {
                positions[count++] = pos;
            }
            unchecked {
                i++;
            }
        }
        Position[] memory result = new Position[](count);
        for (uint256 i; i < count; ) {
            result[i] = positions[i];
            unchecked {
                i++;
            }
        }
        return result;
    }

    function _getFilteredBufferPositions(
        Position[] memory bufferedPositions,
        uint256[] memory stakeIds,
        function(Position memory) view returns (bool) pred
    ) private view returns (Position[] memory) {
        Position[] memory filteredPositions = new Position[](stakeIds.length);
        uint256 count;
        for (uint256 i; i < stakeIds.length; ) {
            Position memory pos = bufferedPositions[stakeIds[i]];
            if (pred(pos)) {
                filteredPositions[count++] = pos;
            }
            unchecked {
                i++;
            }
        }
        Position[] memory result = new Position[](count);
        for (uint256 i; i < count; ) {
            result[i] = filteredPositions[i];
            unchecked {
                i++;
            }
        }
        return result;
    }

    function _getNonEmptyPositions(address account, address fund) private view returns (Position[] memory) {
        return _getFilteredPositions(account, fund, _isPositionNonEmpty);
    }

    function _getOpenPositions(address account, address fund) private view returns (Position[] memory) {
        return _getFilteredPositions(account, fund, _isPositionOpen);
    }

    function _getNonEmptyBufferedPositions(
        Position[] memory bufferedPositions,
        uint256[] memory stakeIds
    ) private view returns (Position[] memory) {
        return _getFilteredBufferPositions(bufferedPositions, stakeIds, _isPositionNonEmpty);
    }

    function _getOpenBufferedPositions(
        Position[] memory bufferedPositions,
        uint256[] memory stakeIds
    ) private view returns (Position[] memory) {
        return _getFilteredBufferPositions(bufferedPositions, stakeIds, _isPositionOpen);
    }

    function _getDiscountForBuffer(
        Position[] memory stakingPositionsBuffer,
        uint256 stakingPositionsBufferAmount,
        uint256 investment,
        uint256 timestamp
    ) private view returns (uint256) {
        uint256 totalDiscount;
        for (uint256 i; i < stakingPositionsBufferAmount; ) {
            totalDiscount += _getDiscountForPosition(stakingPositionsBuffer[i], timestamp, investment);
            unchecked {
                i++;
            }
        }
        return Math.min(totalDiscount, maxDiscount);
    }

    function _reduceBufferedPosition(
        uint256 id,
        uint256 toReduce,
        Position[] memory stakingPositionsBuffer,
        uint256 stakingPositionsBufferAmount
    ) private pure {
        for (uint i; i < stakingPositionsBufferAmount; ) {
            if (stakingPositionsBuffer[i].id == id) {
                Position memory posTemp = stakingPositionsBuffer[i];
                uint256 newAmount = posTemp.amountInWlth - toReduce;

                stakingPositionsBuffer[i].amountInUsdc = uint128(
                    Math.mulDiv(posTemp.amountInUsdc, newAmount, posTemp.amountInWlth)
                );
                stakingPositionsBuffer[i].amountInWlth = uint128(newAmount);
                break;
            }
            unchecked {
                i++;
            }
        }
    }

    function _unstakeWithPenaltyFromBuffer(
        uint256[] memory ids,
        uint256[] memory toUnstake,
        Position[] memory stakingPositionsBuffer,
        uint256 stakingPositionsBufferAmount
    ) private view returns (uint256, uint256) {
        uint256 totalUnstaked;
        uint256 totalPenalty;
        for (uint256 i; i < ids.length; ) {
            Position memory pos = stakingPositions[ids[i]];
            (uint256 unstaked, uint256 penalty) = _getUnstakedAndPenalty(pos, toUnstake[i]);
            totalUnstaked += unstaked;
            totalPenalty += penalty;
            _reduceBufferedPosition(ids[i], unstaked, stakingPositionsBuffer, stakingPositionsBufferAmount);
            unchecked {
                i++;
            }
        }
        return (totalUnstaked, totalPenalty);
    }

    uint256[38] private __gap;
}
