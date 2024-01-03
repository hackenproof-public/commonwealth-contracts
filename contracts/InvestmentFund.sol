// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ERC165Upgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {IInvestmentFund} from "./interfaces/IInvestmentFund.sol";
import {IInvestmentNFT} from "./interfaces/IInvestmentNFT.sol";
import {IStakingWlth} from "./interfaces/IStakingWlth.sol";
import {IProject} from "./interfaces/IProject.sol";
import {LibFund} from "./libraries/LibFund.sol";
import {BASIS_POINT_DIVISOR, LOWEST_CARRY_FEE} from "./libraries/Constants.sol";
import {_transfer, _transferFrom} from "./libraries/Utils.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {StateMachine} from "./StateMachine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error InvestmentFund__NotRegisteredProject(address project);
error InvestmentFund__ZeroProfitProvided();
error InvestmentFund__NoFundsAvailable(address investor);
error InvestmentFund__NotTheUnlocker(address account);
error InvestmentFund__NoPayoutToUnclock();
error InvestmentFund__PayoutIndexTooHigh();
error InvestmentFund__PayoutIndexTooLow();
error InvestmentFund__ZeroAmountInvested();
error InvestmentFund__TotalInvestmentAboveCap(uint256 newTotalInvestment);
error InvestmentFund__NotEnoughTokensOnInvestmentFund();
error InvestmentFund__ProjectExist();
error InvestmentFund__ProjectZeroAddress();
error InvestmentFund__InvalidBlockNumber();
error InvestmentFund__UnlockerZeroAddress();
error InvestmentFund__CurrencyZeroAddress();
error InvestmentFund__InvestmentNftZeroAddress();
error InvestmentFund__StakingWlthZeroAddress();
error InvestmentFund__TreasuryZeroAddress();
error InvestmentFund__LpPoolZeroAddress();
error InvestmentFund__BurnZeroAddress();
error InvestmentFund__CommunityFundZeroAddress();
error InvestmentFund__GenesisNftRevenueZeroAddress();
error InvestmentFund__InvalidManagementFee();
error InvestmentFund__InvalidInvestmentCap();
error InvestmentFund__InvestmentNftInterfaceNotSupported();

/**
 * @title Investment Fund contract
 */
contract InvestmentFund is
    OwnablePausable,
    StateMachine,
    IInvestmentFund,
    ReentrancyGuardUpgradeable,
    ERC165Upgradeable
{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeERC20 for IERC20;

    struct PayoutPtr {
        uint256 index;
        uint256 withdrawn;
    }

    struct FeeDistributionAddresses {
        address treasuryWallet;
        address lpPool;
        address burn;
        address communityFund;
        address genesisNftRevenue;
    }

    /**
     * @notice Address of payout un
     */
    address public unlocker;

    /**
     * @notice Fund name
     */
    string public name;

    /**
     * @notice Address of token collected from investors
     */
    address public currency;

    /**
     * @notice Address of Investment NFT contract
     */
    address public investmentNft;

    /**
     * @notice Address of Staking Wlth contract
     */
    IStakingWlth public stakingWlth;

    /**
     * @notice Wallet collecting fees
     */
    address public treasuryWallet;

    /**
     * @notice Wallet collecting fees
     */
    address public genesisNftRevenue;

    /**
     * @notice Wallet collecting fees
     */
    address public lpPoolAddress;

    /**
     * @notice Wallet collecting fees
     */
    address public burnAddress;

    /**
     * @notice Management fee value
     */
    uint16 public managementFee;

    /**
     * @notice The address of the community fund
     */
    address public communityFund;

    /**
     * @notice Fund capacity above which collecting funds is stopped
     */
    uint256 public cap;

    /**
     * @notice Total income from sold project tokens
     */
    uint256 public totalIncome;

    /**
     * @notice The index of the next payout to unlock
     */
    uint256 public nextPayoutToUnlock;

    /**
     * @notice List of payouts (incomes from tokens sale)
     */
    Payout[] public payouts;

    /**
     * @notice Total withdrawn amount per user
     */
    mapping(address => uint256) public userTotalWithdrawal;

    /**
     * @dev The index of the next user payout
     */
    mapping(address => uint256) private userNextPayout;

    /**
     * @dev List of projects
     */
    EnumerableSetUpgradeable.AddressSet private _projects;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param owner_ Contract owner
     * @param unlocker_ Address of payout unlocker
     * @param name_ Investment fund name
     * @param currency_ Address of currency for investments
     * @param investmentNft_ Address of investment NFT contract
     * @param stakingWlth_ Address of contract for staking WLTH
     * @param feeDistributionAddresses_ Addresses of fee distribution wallets
     * @param managementFee_ Management fee value
     * @param cap_ Cap value
     */
    function initialize(
        address owner_,
        address unlocker_,
        string memory name_,
        address currency_,
        address investmentNft_,
        address stakingWlth_,
        FeeDistributionAddresses memory feeDistributionAddresses_,
        uint16 managementFee_,
        uint256 cap_
    ) public initializer {
        __Context_init();
        {
            __OwnablePausable_init(owner_);
        }
        __StateMachine_init(LibFund.STATE_FUNDS_IN);
        __ReentrancyGuard_init();
        __ERC165_init();

        if (unlocker_ == address(0)) revert InvestmentFund__UnlockerZeroAddress();
        if (currency_ == address(0)) revert InvestmentFund__CurrencyZeroAddress();
        if (investmentNft_ == address(0)) revert InvestmentFund__InvestmentNftZeroAddress();
        if (stakingWlth_ == address(0)) revert InvestmentFund__StakingWlthZeroAddress();
        if (feeDistributionAddresses_.treasuryWallet == address(0)) revert InvestmentFund__TreasuryZeroAddress();
        if (feeDistributionAddresses_.lpPool == address(0)) revert InvestmentFund__LpPoolZeroAddress();
        if (feeDistributionAddresses_.burn == address(0)) revert InvestmentFund__BurnZeroAddress();
        if (feeDistributionAddresses_.communityFund == address(0)) revert InvestmentFund__CommunityFundZeroAddress();
        if (feeDistributionAddresses_.genesisNftRevenue == address(0))
            revert InvestmentFund__GenesisNftRevenueZeroAddress();
        if (managementFee_ >= 10000) revert InvestmentFund__InvalidManagementFee();
        if (cap_ <= 0) revert InvestmentFund__InvalidInvestmentCap();
        if (!IERC165Upgradeable(investmentNft_).supportsInterface(type(IInvestmentNFT).interfaceId) == true)
            revert InvestmentFund__InvestmentNftInterfaceNotSupported();

        unlocker = unlocker_;
        name = name_;
        currency = currency_;
        investmentNft = investmentNft_;
        stakingWlth = IStakingWlth(stakingWlth_);
        treasuryWallet = feeDistributionAddresses_.treasuryWallet;
        genesisNftRevenue = feeDistributionAddresses_.genesisNftRevenue;
        lpPoolAddress = feeDistributionAddresses_.lpPool;
        burnAddress = feeDistributionAddresses_.burn;
        communityFund = feeDistributionAddresses_.communityFund;
        managementFee = managementFee_;
        cap = cap_;

        _initializeStates();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function invest(uint240 amount, string calldata tokenUri) external override onlyAllowedStates nonReentrant {
        if (amount <= 0) revert InvestmentFund__ZeroAmountInvested();
        uint256 actualCap = cap;

        uint256 newTotalInvestment = IInvestmentNFT(investmentNft).getTotalInvestmentValue() + amount;
        if (newTotalInvestment > actualCap) revert InvestmentFund__TotalInvestmentAboveCap(newTotalInvestment);

        if (newTotalInvestment == actualCap) {
            currentState = LibFund.STATE_CAP_REACHED;
            emit CapReached(actualCap);
        }

        _invest(_msgSender(), amount, tokenUri);
    }

    /**
     * @inheritdoc IInvestmentFund
     */

    function unlockPayoutsTo(uint256 index) external onlyAllowedStates {
        if (_msgSender() != unlocker) {
            revert InvestmentFund__NotTheUnlocker(_msgSender());
        }
        uint payoutsCount = payouts.length;
        uint256 nextPayout = nextPayoutToUnlock;

        if (nextPayoutToUnlock >= payoutsCount) {
            revert InvestmentFund__NoPayoutToUnclock();
        }
        if (index < nextPayoutToUnlock) {
            revert InvestmentFund__PayoutIndexTooLow();
        }
        if (index >= payoutsCount) {
            revert InvestmentFund__PayoutIndexTooHigh();
        }

        for (uint256 i = nextPayout; i <= index; ) {
            payouts[i].locked = false;
            unchecked {
                i++;
            }
        }

        nextPayoutToUnlock = index + 1;
        emit PayoutsUnlocked(nextPayout, index);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function withdraw() external onlyAllowedStates nonReentrant {
        (uint256 amount, uint256 carryFee, uint256 nextUserPayoutIndex) = getAvailableFundsDetails(_msgSender());

        address currencyAddress = currency;
        userTotalWithdrawal[_msgSender()] += amount;
        userNextPayout[_msgSender()] = nextUserPayoutIndex;

        if (amount == 0) {
            revert InvestmentFund__NoFundsAvailable(_msgSender());
        }

        if (carryFee > 0) {
            _carryFeeDistribution(carryFee);
        }

        _transfer(currencyAddress, _msgSender(), amount);

        emit ProfitWithdrawn(_msgSender(), currencyAddress, amount);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getAvailableFundsDetails(
        address account
    ) public view returns (uint256 amount, uint256 carryFee, uint256 nextUserPayoutIndex) {
        nextUserPayoutIndex = userNextPayout[account];
        uint256 nextPayoutIndex = nextPayoutToUnlock;

        if (nextUserPayoutIndex >= nextPayoutIndex) {
            return (0, 0, nextUserPayoutIndex);
        }

        for (uint256 i = nextUserPayoutIndex; i < nextPayoutIndex; ) {
            Payout memory payout = payouts[i];
            if (payouts[i].inProfit) {
                uint256 userIncomeBeforeCarryFee = _calculateUserIncomeInBlock(payout.value, account, payout.blockData);

                uint256 carryFeeSize = _getCarryFeeSize(account, block.timestamp, payout.blockData.number);

                amount +=
                    userIncomeBeforeCarryFee -
                    MathUpgradeable.mulDiv(userIncomeBeforeCarryFee, carryFeeSize, BASIS_POINT_DIVISOR);

                if (carryFeeSize > LOWEST_CARRY_FEE) {
                    carryFeeSize -= LOWEST_CARRY_FEE;
                }
                carryFee += MathUpgradeable.mulDiv(userIncomeBeforeCarryFee, carryFeeSize, BASIS_POINT_DIVISOR);
            } else {
                amount += _calculateUserIncomeInBlock(payout.value, account, payout.blockData);
            }
            unchecked {
                i++;
            }
        }
        return (amount, carryFee, nextPayoutIndex);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getPayoutsCount() external view returns (uint256) {
        return payouts.length;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function addProject(address project) external onlyAllowedStates onlyOwner {
        if (project == address(0)) revert InvestmentFund__ProjectZeroAddress();
        if (_projects.contains(project)) revert InvestmentFund__ProjectExist();

        _projects.add(project);

        emit ProjectAdded(_msgSender(), project);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function listProjects() external view returns (address[] memory) {
        return _projects.values();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getProjectsCount() external view returns (uint256) {
        return _projects.length();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function removeProject(address project) external onlyAllowedStates onlyOwner {
        if (!_projects.contains(project)) revert InvestmentFund__NotRegisteredProject(_msgSender());
        _projects.remove(project);
        emit ProjectRemoved(_msgSender(), project);
    }

    function stopCollectingFunds() external onlyAllowedStates onlyOwner {
        currentState = LibFund.STATE_CAP_REACHED;
    }

    // TODO: business logic clarification with client
    function deployFunds() external onlyAllowedStates onlyOwner {
        // for (uint256 i; i < _projects.length(); i++) {
        //     address project = _projects.at(i);
        //     uint256 amount = IProject(project).getFundsAllocation();
        //     if(IERC20(currency).balanceOf(address(this)) < amount) revert InvestmentFund__NotEnoughTokensOnInvestmentFund();
        //     IERC20(currency).approve(project, amount);
        //     IProject(project).deployFunds(amount);
        //     unchecked {i++;}
        // }
        currentState = LibFund.STATE_FUNDS_DEPLOYED;
    }

    // temporary manual deployment of funds to specified project
    /**
     * @inheritdoc IInvestmentFund
     */
    function deployFundsToProject(address project, uint256 amount) external onlyOwner {
        if (!_projects.contains(project)) revert InvestmentFund__NotRegisteredProject(project);
        if (IERC20(currency).balanceOf(address(this)) < amount)
            revert InvestmentFund__NotEnoughTokensOnInvestmentFund();

        IERC20(currency).safeIncreaseAllowance(project, amount);
        IProject(project).deployFunds(amount);

        emit FundsDeployedToProject(address(this), project, amount);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function provideProfit(uint256 amount) external onlyAllowedStates nonReentrant {
        if (!_projects.contains(_msgSender())) {
            revert InvestmentFund__NotRegisteredProject(_msgSender());
        }
        if (amount == 0) {
            revert InvestmentFund__ZeroProfitProvided();
        }

        Block memory blockData = Block(uint128(block.number), uint128(block.timestamp));

        uint256 newTotalIncome = totalIncome + amount;
        uint256 totalInvestment = IInvestmentNFT(investmentNft).getTotalInvestmentValue();
        uint256 initialCarryFee;
        if (totalIncome >= totalInvestment) {
            initialCarryFee = MathUpgradeable.mulDiv(amount, LOWEST_CARRY_FEE, BASIS_POINT_DIVISOR);
            payouts.push(Payout(amount, blockData, true, true));
        } else {
            if (newTotalIncome > totalInvestment) {
                uint256 profitAboveBreakeven = newTotalIncome - totalInvestment;
                initialCarryFee = MathUpgradeable.mulDiv(profitAboveBreakeven, LOWEST_CARRY_FEE, BASIS_POINT_DIVISOR);

                payouts.push(Payout(amount - profitAboveBreakeven, blockData, false, true));
                payouts.push(Payout(profitAboveBreakeven, blockData, true, true));

                emit BreakevenReached(totalInvestment);
            } else {
                payouts.push(Payout(amount, blockData, false, true));

                if (newTotalIncome == totalInvestment) {
                    emit BreakevenReached(totalInvestment);
                }
            }
        }

        totalIncome = newTotalIncome;

        _transferFrom(currency, _msgSender(), address(this), amount);

        if (initialCarryFee > 0) {
            _carryFeeDistribution(initialCarryFee);
        }

        emit ProfitProvided(address(this), amount, initialCarryFee, blockData.number);
    }

    function closeFund() external onlyAllowedStates onlyOwner {
        currentState = LibFund.STATE_CLOSED;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function isInProfit() public view returns (bool) {
        return totalIncome > IInvestmentNFT(investmentNft).getTotalInvestmentValue();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getDetails() external view returns (Details memory) {
        return
            Details(
                name,
                currency,
                investmentNft,
                treasuryWallet,
                genesisNftRevenue,
                lpPoolAddress,
                burnAddress,
                communityFund,
                managementFee,
                cap,
                IInvestmentNFT(investmentNft).getTotalInvestmentValue(),
                totalIncome,
                payouts,
                currentState
            );
    }

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IInvestmentFund).interfaceId || super.supportsInterface(interfaceId);
    }

    function _initializeStates() internal {
        allowFunction(LibFund.STATE_FUNDS_IN, this.addProject.selector);
        allowFunction(LibFund.STATE_FUNDS_IN, this.removeProject.selector);
        allowFunction(LibFund.STATE_FUNDS_IN, this.invest.selector);
        allowFunction(LibFund.STATE_FUNDS_IN, this.stopCollectingFunds.selector);
        allowFunction(LibFund.STATE_CAP_REACHED, this.deployFunds.selector);

        allowFunction(LibFund.STATE_FUNDS_IN, this.deployFundsToProject.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.deployFundsToProject.selector);

        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.provideProfit.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.unlockPayoutsTo.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.withdraw.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.closeFund.selector);
    }

    function _invest(address investor, uint256 amount, string calldata tokenUri) internal {
        uint256 fee = (uint256(amount) * managementFee) / BASIS_POINT_DIVISOR;
        address currencyAddress = currency;

        _transferFrom(currency, investor, treasuryWallet, fee);
        _transferFrom(currency, investor, address(this), amount - fee);
        IInvestmentNFT(investmentNft).mint(investor, amount, tokenUri);

        emit Invested(investor, currencyAddress, amount, fee);
    }

    function _calculateUserIncomeInBlock(
        uint256 income,
        address account,
        Block memory blockData
    ) private view returns (uint256) {
        (uint256 userValue, uint256 totalValue) = _getUserParticipationInFund(account, blockData.number);
        if (totalValue > 0) {
            return (income * userValue) / totalValue;
        } else {
            return 0;
        }
    }

    function _getUserParticipationInFund(
        address account,
        uint256 blockNumber
    ) private view returns (uint256 userValue, uint256 totalValue) {
        if (blockNumber > block.number) revert InvestmentFund__InvalidBlockNumber();

        if (blockNumber < block.number) {
            return IInvestmentNFT(investmentNft).getPastParticipation(account, blockNumber);
        } else {
            return IInvestmentNFT(investmentNft).getParticipation(account);
        }
    }

    /**
     * @dev Returns carry fee in basis points for account in timestamp
     */
    function _getCarryFeeSize(address account, uint256 timestamp, uint256 blockNumber) private view returns (uint256) {
        return
            MathUpgradeable.max(
                LibFund.DEFAULT_CARRY_FEE -
                    stakingWlth.getDiscountFromPreviousInvestmentInTimestamp(
                        account,
                        address(this),
                        timestamp,
                        blockNumber
                    ),
                1000
            );
    }

    // TODO: ZkSync transactions batching handling?
    function _carryFeeDistribution(uint256 carryFee) internal {
        _transfer(currency, treasuryWallet, (carryFee * 68) / 100);
        _transfer(currency, genesisNftRevenue, (carryFee * 12) / 100);
        _transfer(currency, lpPoolAddress, (carryFee * 99) / 1000);
        _transfer(currency, burnAddress, (carryFee * 99) / 1000);
        _transfer(currency, communityFund, (carryFee * 2) / 1000);
    }

    uint256[39] private __gap;
}
