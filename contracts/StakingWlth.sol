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
import {BASIS_POINT_DIVISOR} from "./libraries/Constants.sol";

/**
 * @title Staking WLTH contract
 */
contract StakingWlth is OwnablePausable, IStakingWlth, ReentrancyGuardUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.UintToUintMap;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public constant MAX_UNSTAKING_PENALTY = 8000; // in basis points

    address public token;
    address public usdc;
    uint256 public transactionFee;
    address public treasury;
    uint256 public maxDiscount;
    IDexQuoter public dexQuoter;
    mapping(uint256 => Position) public stakingPositions;
    mapping(address => mapping(address => uint256[])) public stakesPerAccount;
    CountersUpgradeable.Counter public counter;

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
     * @param treasuryWallet Address of fee recipient
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
        address treasuryWallet,
        uint256 maxDiscount_,
        uint256[] memory durations,
        uint256[] memory coefficients
    ) public initializer {
        require(token_ != address(0), "Token is zero address");
        require(usdc_ != address(0), "USDC token is zero address");
        require(dexQuoter_ != address(0), "DEX quoter is zero address");
        require(treasuryWallet != address(0), "Treasury is zero address");
        require(durations.length == coefficients.length, "Durations and coefficients lengths mismatch");

        __Context_init();
        __OwnablePausable_init(owner);
        __ReentrancyGuard_init();

        token = token_;
        usdc = usdc_;
        dexQuoter = IDexQuoter(dexQuoter_);
        transactionFee = fee_;
        treasury = treasuryWallet;
        maxDiscount = maxDiscount_;

        for (uint256 i = 0; i < durations.length; i++) {
            require(durationCoefficients.set(durations[i], coefficients[i]), "Cannot initialize duration coefficients");
        }
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function stake(address fund, uint256 amount, uint256 duration) external nonReentrant {
        require(registeredFunds.contains(fund), "Fund is not registered");
        require(amount > 0, "Invalid staking amount");
        require(durationCoefficients.contains(duration), "Invalid staking duration");

        uint256 investment = _getCurrentInvestment(_msgSender(), fund);
        uint256 totalTargetDiscount = _getTotalTargetDiscount(_msgSender(), fund);

        (uint256 amountInUsdc, , , ) = dexQuoter.quote(token, usdc, amount);
        uint256 discountFromStake = _calculateTargetDiscount(amountInUsdc, duration, investment);

        require(discountFromStake > 0, "Target discount is equal to zero");
        require(totalTargetDiscount + discountFromStake <= maxDiscount, "Target discount exceeds maximum value");

        Period memory period = Period(uint128(block.timestamp), uint128(duration));
        uint256 stakeId = _createStakingPosition(_msgSender(), fund, amount, amountInUsdc, investment, period);

        stakesPerAccount[_msgSender()][fund].push(stakeId);
        stakingAccounts.add(_msgSender());

        emit TokensStaked(_msgSender(), fund, stakeId, amount);

        uint256 fee = Math.mulDiv(amount, transactionFee, BASIS_POINT_DIVISOR);
        if (fee > 0) {
            IERC20Upgradeable(token).safeTransferFrom(_msgSender(), treasury, fee);
        }
        IERC20Upgradeable(token).safeTransferFrom(_msgSender(), address(this), amount - fee);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function unstake(address fund, uint256 amount) external nonReentrant {
        _validateUnstake(_msgSender(), fund, amount);

        if (_isFundInCRP(fund)) {
            _unstakeFromAllPositions(_msgSender(), fund, amount);
        } else {
            uint256 unstaked = _unstakeFromEndedPositions(_msgSender(), fund, amount);
            if (unstaked < amount) {
                uint256 remainingAmount = amount - unstaked;

                unstaked = _unstakeUnlocked(_msgSender(), fund, remainingAmount);
                if (unstaked < remainingAmount) {
                    remainingAmount -= unstaked;

                    (, uint256 penalty) = _unstakeLocked(_msgSender(), fund, remainingAmount);
                    if (penalty > 0) {
                        amount -= penalty;
                        IWlth(token).burn(penalty);
                    }
                }
            }
        }

        IERC20Upgradeable(token).safeTransfer(_msgSender(), amount);

        emit TokensUnstaked(_msgSender(), fund, amount);
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

        return Math.min(_getDiscountForAccount(account, fund, block.timestamp), maxDiscount);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getDiscountInTimestamp(address account, address fund, uint256 timestamp) external view returns (uint256) {
        require(registeredFunds.contains(fund), "Fund is not registered");

        return Math.min(_getDiscountForAccount(account, fund, timestamp), maxDiscount);
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
        require(registeredFunds.contains(fund), "Fund is not registered");

        return _getEstimatedDiscount(account, fund, amountInUsdc, period, timestamp);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getStakedTokensInFund(address account, address fund) public view returns (uint256) {
        uint256 tokens = 0;
        Position[] memory positions = _getPositions(account, fund);
        for (uint256 i = 0; i < positions.length; i++) {
            Position memory pos = positions[i];
            tokens += (pos.amountInWlth - pos.unstakedEnded);
        }
        return tokens;
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
    function getTotalUnlockedTokens(address account, address fund) external view returns (uint256) {
        require(registeredFunds.contains(fund), "Fund is not registered");

        return _getUnlockedByPositionEnd(account, fund) + _getUnlockedByInvestmentChange(account, fund);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getUnlockedByPositionEnd(address account, address fund) public view returns (uint256) {
        require(registeredFunds.contains(fund), "Fund is not registered");

        return _getUnlockedByPositionEnd(account, fund);
    }

    /**
     * @inheritdoc IStakingWlth
     */
    function getUnlockedByInvestmentChange(address account, address fund) public view returns (uint256) {
        require(registeredFunds.contains(fund), "Fund is not registered");

        return _getUnlockedByInvestmentChange(account, fund);
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

    function _getUnlockedByPositionEnd(address account, address fund) private view returns (uint256) {
        uint256 unlocked = 0;
        Position[] memory closedPositions = _getFilteredPositions(account, fund, _isPositionEnded);
        for (uint256 i = 0; i < closedPositions.length; i++) {
            Position memory pos = closedPositions[i];
            if (_isPositionEnded(pos)) {
                unlocked += (pos.amountInWlth - pos.unstakedEnded);
            }
        }
        return unlocked;
    }

    function _getUnlockedByInvestmentChange(address account, address fund) private view returns (uint256) {
        Position[] memory openPositions = _getFilteredPositions(account, fund, _isPositionOpen);
        uint256 totalTargetDiscount = _getTotalTargetDiscount(account, fund);
        uint256 investmentSize = _getCurrentInvestment(account, fund);
        (uint256 unlocked, , ) = _getUnlockedTokens(openPositions, totalTargetDiscount, investmentSize);

        return unlocked;
    }

    function _unstakeFromAllPositions(address account, address fund, uint256 amount) private returns (uint256) {
        (uint256[] memory ids, uint256[] memory staked) = _getAllStakedTokens(account, fund);
        (uint256 totalCount, uint256[] memory amountsToUnstake) = _getTokensToUnstake(amount, ids, staked);
        _unstake(ids, amountsToUnstake);
        return totalCount;
    }

    function _unstakeFromEndedPositions(address account, address fund, uint256 amount) private returns (uint256) {
        uint256 remainingAmount = amount;
        Position[] memory closedPosistions = _getFilteredPositions(account, fund, _isPositionEnded);
        for (uint256 i = 0; i < closedPosistions.length && remainingAmount > 0; i++) {
            Position memory pos = closedPosistions[i];
            if (_isPositionEnded(pos)) {
                uint256 toUnstake = Math.min(amount, pos.amountInWlth - pos.unstakedEnded);
                stakingPositions[pos.id].unstakedEnded += toUnstake;
                remainingAmount -= toUnstake;
            }
        }
        return (amount - remainingAmount);
    }

    function _unstakeUnlocked(address account, address fund, uint256 amount) private returns (uint256) {
        Position[] memory openPositions = _getFilteredPositions(account, fund, _isPositionOpen);
        uint256 totalDiscount = _getTotalTargetDiscount(account, fund);
        uint256 investmentSize = _getCurrentInvestment(account, fund);

        (uint256 totalCount, uint256[] memory ids, uint256[] memory counts) = _getUnlockedTokens(
            openPositions,
            totalDiscount,
            investmentSize
        );

        uint256 toUnstake = Math.min(amount, totalCount);
        (uint256 totalToUnstake, uint256[] memory amountsToUnstake) = _getTokensToUnstake(toUnstake, ids, counts);
        _unstake(ids, amountsToUnstake);

        return totalToUnstake;
    }

    function _unstakeLocked(address account, address fund, uint256 amount) private returns (uint256, uint256) {
        Position[] memory openPositions = _getFilteredPositions(account, fund, _isPositionOpen);
        (uint256 totalCount, uint256[] memory ids, uint256[] memory counts) = _getStakedTokensFromPositions(
            openPositions
        );

        uint256 toUnstake = Math.min(amount, totalCount);
        (, uint256[] memory amountsToUnstake) = _getTokensToUnstake(toUnstake, ids, counts);
        (uint256 totalUnstaked, uint256 totalPenalty) = _unstakeWithPenalty(ids, amountsToUnstake);

        return (totalUnstaked, totalPenalty);
    }

    function _getAllStakedTokens(
        address account,
        address fund
    ) private view returns (uint256[] memory, uint256[] memory) {
        Position[] memory positions = _getPositions(account, fund);
        (, uint256[] memory ids, uint256[] memory available) = _getStakedTokensFromPositions(positions);
        return (ids, available);
    }

    function _getStakedTokensFromPositions(
        Position[] memory positions
    ) private pure returns (uint256, uint256[] memory, uint256[] memory) {
        uint256 totalCount = 0;
        uint256[] memory ids = new uint256[](positions.length);
        uint256[] memory staked = new uint256[](positions.length);
        for (uint256 i = 0; i < positions.length; i++) {
            Position memory pos = positions[i];
            ids[i] = pos.id;
            staked[i] = pos.amountInWlth;
            totalCount += pos.amountInWlth;
        }
        return (totalCount, ids, staked);
    }

    function _getUnlockedTokens(
        Position[] memory openPositions,
        uint256 totalTargetDiscount,
        uint256 investmentSize
    ) private view returns (uint256, uint256[] memory, uint256[] memory) {
        if (investmentSize == 0) {
            return _getStakedTokensFromPositions(openPositions);
        }

        uint256 totalUnlocked = 0;
        uint256[] memory ids = new uint256[](openPositions.length);
        uint256[] memory unlocked = new uint256[](openPositions.length);

        if (totalTargetDiscount > maxDiscount) {
            uint256 totalDiscountOfOpen = _getTotalTargetDiscountForPositions(openPositions, investmentSize);
            uint256 totalDiscountOfClosed = totalTargetDiscount - totalDiscountOfOpen;
            uint256 remainingDiscountToHandle = totalDiscountOfClosed < maxDiscount
                ? maxDiscount - totalDiscountOfClosed
                : 0;

            for (uint256 i = 0; i < openPositions.length; i++) {
                Position memory pos = openPositions[i];
                ids[i] = pos.id;
                uint256 workingTokens = Math.mulDiv(pos.amountInWlth, remainingDiscountToHandle, totalDiscountOfOpen);
                uint256 unlockedTokens = pos.amountInWlth - workingTokens;
                unlocked[i] = unlockedTokens;
                totalUnlocked += unlockedTokens;
            }
        }
        return (totalUnlocked, ids, unlocked);
    }

    function _getTokensToUnstake(
        uint256 amount,
        uint256[] memory ids,
        uint256[] memory available
    ) private pure returns (uint256, uint256[] memory) {
        uint256[] memory amountsToUnstake = new uint256[](ids.length);

        uint256 remainingAmount = amount;
        uint256 totalUnstaked = 0;
        uint256 numberOfPositions = ids.length;
        uint256 maxIterations = numberOfPositions;
        for (uint256 iter = 0; remainingAmount > 0 && iter < maxIterations && numberOfPositions > 0; iter++) {
            uint256 count = numberOfPositions;
            uint256 average = remainingAmount / count;
            if (average > 0) {
                for (uint256 i = 0; i < count; i++) {
                    uint256 toUnstake = Math.min(average, available[i]);
                    if (toUnstake > 0) {
                        remainingAmount -= toUnstake;
                        totalUnstaked += toUnstake;
                        amountsToUnstake[i] += toUnstake;
                        available[i] -= toUnstake;
                        if (available[i] == 0) {
                            numberOfPositions--;
                        }
                    }
                }
            }
        }
        require(totalUnstaked == amount, "Tokens not available to unstake");

        return (totalUnstaked, amountsToUnstake);
    }

    function _unstake(uint256[] memory ids, uint256[] memory toUnstake) private {
        for (uint256 i = 0; i < ids.length; i++) {
            _reducePosition(ids[i], toUnstake[i]);
        }
    }

    function _unstakeWithPenalty(uint256[] memory ids, uint256[] memory toUnstake) private returns (uint256, uint256) {
        uint256 totalUnstaked = 0;
        uint256 totalPenalty = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Position memory pos = stakingPositions[ids[i]];
            (uint256 unstaked, uint256 penalty) = _getUnstakedAndPenalty(pos, toUnstake[i]);
            totalUnstaked += unstaked;
            totalPenalty += penalty;
            _reducePosition(ids[i], unstaked);
        }
        return (totalUnstaked, totalPenalty);
    }

    function _reducePosition(uint256 id, uint256 toReduce) private {
        Position memory pos = stakingPositions[id];
        uint256 newAmount = pos.amountInWlth - toReduce;

        stakingPositions[id].amountInWlth = uint128(newAmount);
        stakingPositions[id].amountInUsdc = uint128(Math.mulDiv(pos.amountInUsdc, newAmount, pos.amountInWlth));
    }

    function _getEstimatedDiscount(
        address account,
        address fund,
        uint256 amountInUsdc,
        Period memory period,
        uint256 timestamp
    ) private view returns (uint256) {
        uint256 currentDiscount = _getDiscountForAccount(account, fund, timestamp);

        uint256 investment = _getCurrentInvestment(account, fund);
        uint256 newTargetDiscount = _calculateTargetDiscount(amountInUsdc, period.duration, investment);
        uint256 discountFromStake = _getDiscountFunction(_isFundInCRP(fund))(period, newTargetDiscount, timestamp);

        return currentDiscount + discountFromStake;
    }

    function _getDiscountForAccount(address account, address fund, uint256 timestamp) private view returns (uint256) {
        uint256 totalDiscount = 0;
        uint256[] memory stakeIds = stakesPerAccount[account][fund];
        for (uint256 i = 0; i < stakeIds.length; i++) {
            totalDiscount += _getDiscountForPosition(stakingPositions[stakeIds[i]], timestamp);
        }
        return totalDiscount;
    }

    function _getDiscountForPosition(Position memory pos, uint256 timestamp) private view returns (uint256) {
        uint256 investmentSize = _getCurrentInvestment(pos.staker, pos.fund);
        uint256 targetDiscount = _calculateTargetDiscount(pos.amountInUsdc, pos.period.duration, investmentSize);
        function(Period memory, uint256, uint256) pure returns (uint256) func = _getDiscountFunction(pos.isCRP);
        return func(pos.period, targetDiscount, timestamp);
    }

    function _getTotalTargetDiscount(address account, address fund) private view returns (uint256) {
        uint256 investmentSize = _getCurrentInvestment(account, fund);
        uint256 discount = 0;
        uint256[] memory stakes = stakesPerAccount[account][fund];
        for (uint256 i = 0; i < stakes.length; i++) {
            Position memory position = stakingPositions[stakes[i]];
            discount += _calculateTargetDiscount(position.amountInUsdc, position.period.duration, investmentSize);
        }
        return discount;
    }

    function _getTotalTargetDiscountForPositions(
        Position[] memory positions,
        uint256 investmentSize
    ) private view returns (uint256) {
        uint256 discount = 0;
        for (uint256 i = 0; i < positions.length; i++) {
            Position memory position = positions[i];
            discount += _calculateTargetDiscount(position.amountInUsdc, position.period.duration, investmentSize);
        }
        return discount;
    }

    function _calculateTargetDiscount(
        uint256 amountInUsdc,
        uint256 period,
        uint256 investment
    ) private view returns (uint256) {
        uint256 amountForMaxDiscount = Math.mulDiv(investment, durationCoefficients.get(period), BASIS_POINT_DIVISOR);
        if (amountForMaxDiscount > 0) {
            return Math.mulDiv(amountInUsdc, maxDiscount, amountForMaxDiscount);
        } else {
            return uint256(type(uint128).max);
        }
    }

    function _getCurrentInvestment(address account, address fund) private view returns (uint256) {
        address nft = IInvestmentFund(fund).investmentNft();
        return IInvestmentNFT(nft).getInvestmentValue(account);
    }

    function _isFundInCRP(address fund) private view returns (bool) {
        bytes32 fundState = IStateMachine(fund).currentState();
        return fundState == LibFund.STATE_FUNDS_IN || fundState == LibFund.STATE_CAP_REACHED;
    }

    function _validateUnstake(address staker, address fund, uint256 amount) private view {
        require(registeredFunds.contains(fund), "Fund is not registered");

        uint256 totalStake = 0;
        uint256[] memory stakeIds = stakesPerAccount[staker][fund];
        for (uint256 i = 0; i < stakeIds.length; i++) {
            Position memory pos = stakingPositions[stakeIds[i]];
            totalStake += pos.amountInWlth;
        }
        require(totalStake >= amount, "Amount to unstake exceeds staked value");
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
        return position.amountInWlth > 0 && _isPositionActive(position);
    }

    function _getPositions(address account, address fund) private view returns (Position[] memory) {
        uint256[] memory stakeIds = stakesPerAccount[account][fund];
        Position[] memory positions = new Position[](stakeIds.length);
        for (uint256 i = 0; i < stakeIds.length; i++) {
            positions[i] = stakingPositions[stakeIds[i]];
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
        uint256 count = 0;
        for (uint256 i = 0; i < stakeIds.length; i++) {
            Position memory pos = stakingPositions[stakeIds[i]];
            if (pred(pos)) {
                positions[count++] = pos;
            }
        }
        Position[] memory result = new Position[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = positions[i];
        }
        return result;
    }

    uint256[38] private __gap;
}
