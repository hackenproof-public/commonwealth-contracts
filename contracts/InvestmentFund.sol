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
error InvestmentFund__InvestmentTooLow();
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
error InvestmmentFund__MaxPercentageWalletInvestmentLimitReached();

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

    /**
     * @notice Management fee value
     */
    uint16 public s_managementFee;

    /**
     * @notice Address of Investment NFT contract
     */
    IInvestmentNFT internal s_investmentNft;

    /**
     * @notice Address of Staking Wlth contract
     */
    IStakingWlth public s_stakingWlth;

    /**
     * @notice Address of payout un
     */
    address private s_unlocker;

    /**
     * @notice Address of token collected from investors
     */
    address private s_currency;

    /**
     * @notice Wallet collecting fees
     */
    address private s_treasuryWallet;

    /**
     * @notice Wallet collecting fees
     */
    address private s_genesisNftRevenue;

    /**
     * @notice Wallet collecting fees
     */
    address private s_lpPoolAddress;

    /**
     * @notice Wallet collecting fees
     */
    address private s_burnAddress;

    /**
     * @notice The address of the community fund
     */
    address private s_communityFund;

    /**
     * @notice Total income from sold project tokens
     */
    uint256 private s_totalIncome;

    /**
     * @notice The index of the next payout to unlock
     */
    uint256 private s_nextPayoutToUnlock;

    /**
     * @notice Maximum percentage of wallet investment limit
     */
    uint256 private s_maxPercentageWalletInvestmentLimit;

    /**
     * @notice Minimum investment value
     */
    uint256 internal s_minimumInvestment;

    /**
     * @notice Fund name
     */
    string private s_name;

    /**
     * @notice Fund capacity above which collecting funds is stopped
     */
    uint256 internal s_cap;

    /**
     * @notice List of payouts (incomes from tokens sale)
     */
    Payout[] private s_payouts;

    /**
     * @notice Total withdrawn amount per user
     */
    mapping(address => uint256) private s_userTotalWithdrawal;

    /**
     * @dev The index of the next user payout
     */
    mapping(address => uint256) private s_userNextPayout;

    /**
     * @dev List of projects
     */
    EnumerableSetUpgradeable.AddressSet private s_projects;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param _owner Contract owner
     * @param _unlocker Address of payout unlocker
     * @param _name Investment fund name
     * @param _currency Address of currency for investments
     * @param _investmentNft Address of investment NFT contract
     * @param _stakingWlth Address of contract for staking WLTH
     * @param _feeDistributionAddresses Addresses of fee distribution wallets
     * @param _managementFee Management fee value
     * @param _cap Cap value
     * @param _maxPercentageWalletInvestmentLimit Maximum percentage of wallet investment limit
     * @param _minimumInvestment Minimum investment value
     */
    function initialize(
        address _owner,
        address _unlocker,
        string memory _name,
        address _currency,
        address _investmentNft,
        address _stakingWlth,
        FeeDistributionAddresses memory _feeDistributionAddresses,
        uint16 _managementFee,
        uint256 _cap,
        uint256 _maxPercentageWalletInvestmentLimit,
        uint256 _minimumInvestment
    ) public virtual initializer {
        __Context_init();
        {
            __OwnablePausable_init(_owner);
        }
        __StateMachine_init(LibFund.STATE_FUNDS_IN);
        __ReentrancyGuard_init();
        __ERC165_init();

        if (_unlocker == address(0)) revert InvestmentFund__UnlockerZeroAddress();
        if (_currency == address(0)) revert InvestmentFund__CurrencyZeroAddress();
        if (_investmentNft == address(0)) revert InvestmentFund__InvestmentNftZeroAddress();
        // if (_stakingWlth == address(0)) revert InvestmentFund__StakingWlthZeroAddress();
        if (_feeDistributionAddresses.treasuryWallet == address(0)) revert InvestmentFund__TreasuryZeroAddress();
        if (_feeDistributionAddresses.lpPool == address(0)) revert InvestmentFund__LpPoolZeroAddress();
        if (_feeDistributionAddresses.burn == address(0)) revert InvestmentFund__BurnZeroAddress();
        if (_feeDistributionAddresses.communityFund == address(0)) revert InvestmentFund__CommunityFundZeroAddress();
        if (_feeDistributionAddresses.genesisNftRevenue == address(0))
            revert InvestmentFund__GenesisNftRevenueZeroAddress();
        if (_managementFee >= 10000) revert InvestmentFund__InvalidManagementFee();
        if (_cap <= 0) revert InvestmentFund__InvalidInvestmentCap();
        if (!IERC165Upgradeable(_investmentNft).supportsInterface(type(IInvestmentNFT).interfaceId) == true)
            revert InvestmentFund__InvestmentNftInterfaceNotSupported();

        s_unlocker = _unlocker;
        s_name = _name;
        s_currency = _currency;
        s_investmentNft = IInvestmentNFT(_investmentNft);
        s_stakingWlth = IStakingWlth(_stakingWlth);
        s_treasuryWallet = _feeDistributionAddresses.treasuryWallet;
        s_genesisNftRevenue = _feeDistributionAddresses.genesisNftRevenue;
        s_lpPoolAddress = _feeDistributionAddresses.lpPool;
        s_burnAddress = _feeDistributionAddresses.burn;
        s_communityFund = _feeDistributionAddresses.communityFund;
        s_managementFee = _managementFee;
        s_cap = _cap;
        s_maxPercentageWalletInvestmentLimit = _maxPercentageWalletInvestmentLimit;
        s_minimumInvestment = _minimumInvestment;

        _initializeStates();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function invest(uint240 _amount) external virtual onlyAllowedStates nonReentrant {
        if (_amount < s_minimumInvestment) revert InvestmentFund__InvestmentTooLow();
        uint256 actualCap = s_cap;

        IInvestmentNFT investmentNFT = s_investmentNft;
        uint256 value = investmentNFT.getInvestmentValue(_msgSender());
        if (value + _amount > (actualCap * s_maxPercentageWalletInvestmentLimit) / BASIS_POINT_DIVISOR) {
            revert InvestmmentFund__MaxPercentageWalletInvestmentLimitReached();
        }

        uint256 newTotalInvestment = investmentNFT.getTotalInvestmentValue() + _amount;
        if (newTotalInvestment > actualCap) revert InvestmentFund__TotalInvestmentAboveCap(newTotalInvestment);

        if (newTotalInvestment == actualCap) {
            currentState = LibFund.STATE_CAP_REACHED;
            emit CapReached(actualCap);
        }

        _invest(_msgSender(), _amount);
    }

    /**
     * @inheritdoc IInvestmentFund
     */

    function unlockPayoutsTo(uint256 _index) external onlyAllowedStates {
        if (_msgSender() != s_unlocker) {
            revert InvestmentFund__NotTheUnlocker(_msgSender());
        }
        uint payoutsCount = s_payouts.length;
        uint256 nextPayout = s_nextPayoutToUnlock;

        if (nextPayout >= payoutsCount) {
            revert InvestmentFund__NoPayoutToUnclock();
        }
        if (_index < nextPayout) {
            revert InvestmentFund__PayoutIndexTooLow();
        }
        if (_index >= payoutsCount) {
            revert InvestmentFund__PayoutIndexTooHigh();
        }

        for (uint256 i = nextPayout; i <= _index; ) {
            s_payouts[i].locked = false;
            unchecked {
                i++;
            }
        }

        s_nextPayoutToUnlock = _index + 1;
        emit PayoutsUnlocked(nextPayout, _index);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function withdraw() external onlyAllowedStates nonReentrant {
        (uint256 amount, uint256 carryFee, uint256 nextUserPayoutIndex) = getAvailableFundsDetails(_msgSender());

        s_userTotalWithdrawal[_msgSender()] += amount;
        s_userNextPayout[_msgSender()] = nextUserPayoutIndex;

        if (amount == 0) {
            revert InvestmentFund__NoFundsAvailable(_msgSender());
        }

        if (carryFee > 0) {
            _carryFeeDistribution(carryFee);
        }

        address currencyAddress = s_currency;
        _transfer(currencyAddress, _msgSender(), amount);

        emit ProfitWithdrawn(_msgSender(), currencyAddress, amount);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function addProject(address _project) external onlyAllowedStates onlyOwner {
        if (_project == address(0)) revert InvestmentFund__ProjectZeroAddress();
        if (s_projects.contains(_project)) revert InvestmentFund__ProjectExist();

        s_projects.add(_project);

        emit ProjectAdded(_msgSender(), _project);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function removeProject(address _project) external onlyAllowedStates onlyOwner {
        if (!s_projects.contains(_project)) revert InvestmentFund__NotRegisteredProject(_project);
        s_projects.remove(_project);
        emit ProjectRemoved(_msgSender(), _project);
    }

    function stopCollectingFunds() external onlyAllowedStates onlyOwner {
        currentState = LibFund.STATE_CAP_REACHED;

        emit CollectingFundsStopped();
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

        emit FundsDeployed();
    }

    // temporary manual deployment of funds to specified project
    /**
     * @inheritdoc IInvestmentFund
     */
    function deployFundsToProject(address _project, uint256 _amount) external onlyOwner {
        if (!s_projects.contains(_project)) revert InvestmentFund__NotRegisteredProject(_project);
        address currencyAddress = s_currency;
        if (IERC20(currencyAddress).balanceOf(address(this)) < _amount)
            revert InvestmentFund__NotEnoughTokensOnInvestmentFund();

        IERC20(currencyAddress).safeIncreaseAllowance(_project, _amount);
        IProject(_project).deployFunds(_amount);

        emit FundsDeployedToProject(address(this), _project, _amount);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function provideProfit(uint256 _amount) external onlyAllowedStates nonReentrant {
        if (!s_projects.contains(_msgSender())) {
            revert InvestmentFund__NotRegisteredProject(_msgSender());
        }
        if (_amount == 0) {
            revert InvestmentFund__ZeroProfitProvided();
        }

        Block memory blockData = Block(uint128(block.number), uint128(block.timestamp));

        uint256 currentTotalIncome = s_totalIncome;
        uint256 newTotalIncome = currentTotalIncome + _amount;
        uint256 totalInvestment = s_investmentNft.getTotalInvestmentValue();
        uint256 initialCarryFee;
        if (currentTotalIncome >= totalInvestment) {
            initialCarryFee = MathUpgradeable.mulDiv(_amount, LOWEST_CARRY_FEE, BASIS_POINT_DIVISOR);
            s_payouts.push(Payout(_amount, blockData, true, true));
        } else {
            if (newTotalIncome > totalInvestment) {
                uint256 profitAboveBreakeven = newTotalIncome - totalInvestment;
                initialCarryFee = MathUpgradeable.mulDiv(profitAboveBreakeven, LOWEST_CARRY_FEE, BASIS_POINT_DIVISOR);

                s_payouts.push(Payout(_amount - profitAboveBreakeven, blockData, false, true));
                s_payouts.push(Payout(profitAboveBreakeven, blockData, true, true));

                emit BreakevenReached(totalInvestment);
            } else {
                s_payouts.push(Payout(_amount, blockData, false, true));

                if (newTotalIncome == totalInvestment) {
                    emit BreakevenReached(totalInvestment);
                }
            }
        }

        s_totalIncome = newTotalIncome;

        _transferFrom(s_currency, _msgSender(), address(this), _amount);

        if (initialCarryFee > 0) {
            _carryFeeDistribution(initialCarryFee);
        }

        emit ProfitProvided(address(this), _amount, initialCarryFee, blockData.number);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function closeFund() external override onlyAllowedStates onlyOwner {
        currentState = LibFund.STATE_CLOSED;
        emit FundClosed();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function setStakingWlth(address _stakingWlth) external override onlyOwner {
        if (_stakingWlth == address(0)) {
            revert InvestmentFund__StakingWlthZeroAddress();
        }

        s_stakingWlth = IStakingWlth(_stakingWlth);
        emit StakingWlthSet(_stakingWlth);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function setMaxPercentageWalletInvestmentLimit(
        uint256 _maxPercentageWalletInvestmentLimit
    ) external override onlyOwner {
        s_maxPercentageWalletInvestmentLimit = _maxPercentageWalletInvestmentLimit;
        emit MaxPercentageWalletInvestmentLimitSet(_maxPercentageWalletInvestmentLimit);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function setMinimumInvestment(uint256 _minimumInvestment) external override onlyOwner {
        s_minimumInvestment = _minimumInvestment;
        emit MinimumInvestmentSet(_minimumInvestment);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function setUnlocker(address _unlocker) external override onlyOwner {
        if (_unlocker == address(0)) {
            revert InvestmentFund__UnlockerZeroAddress();
        }

        s_unlocker = _unlocker;
        emit UnlockerSet(_unlocker);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function increaseCapTo(uint256 _cap) external onlyOwner {
        if (_cap <= s_cap) revert InvestmentFund__InvalidInvestmentCap();
        s_cap = _cap;
        emit CapIncreased(_cap);
    }

    function allowFunctionsInStates() external onlyOwner {
        allowFunction(LibFund.STATE_FUNDS_IN, this.invest.selector);
        allowFunction(LibFund.STATE_CAP_REACHED, this.addProject.selector);
        allowFunction(LibFund.STATE_CAP_REACHED, this.removeProject.selector);

        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.addProject.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.removeProject.selector);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getPayoutsCount() external view returns (uint256) {
        return s_payouts.length;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function listProjects() external view returns (address[] memory) {
        return s_projects.values();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getProjectsCount() external view returns (uint256) {
        return s_projects.length();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function isInProfit() external view returns (bool) {
        return s_totalIncome > s_investmentNft.getTotalInvestmentValue();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getDetails() external view returns (Details memory) {
        return
            Details(
                s_name,
                s_currency,
                address(s_investmentNft),
                s_treasuryWallet,
                s_genesisNftRevenue,
                s_lpPoolAddress,
                s_burnAddress,
                s_communityFund,
                s_managementFee,
                s_cap,
                s_investmentNft.getTotalInvestmentValue(),
                s_totalIncome,
                s_payouts,
                currentState,
                s_maxPercentageWalletInvestmentLimit,
                s_minimumInvestment
            );
    }

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return _interfaceId == type(IInvestmentFund).interfaceId || super.supportsInterface(_interfaceId);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function name() external view override returns (string memory) {
        return s_name;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function currency() external view override returns (address) {
        return s_currency;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function unlocker() external view override returns (address) {
        return s_unlocker;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function investmentNft() external view override returns (address) {
        return address(s_investmentNft);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function stakingWlth() external view override returns (address) {
        return address(s_stakingWlth);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function treasuryWallet() external view override returns (address) {
        return s_treasuryWallet;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function genesisNftRevenue() external view override returns (address) {
        return s_genesisNftRevenue;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function lpPoolAddress() external view override returns (address) {
        return s_lpPoolAddress;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function burnAddress() external view override returns (address) {
        return s_burnAddress;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function managementFee() external view override returns (uint16) {
        return s_managementFee;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function communityFund() external view override returns (address) {
        return s_communityFund;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function cap() external view override returns (uint256) {
        return s_cap;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function totalIncome() external view override returns (uint256) {
        return s_totalIncome;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function nextPayoutToUnlock() external view override returns (uint256) {
        return s_nextPayoutToUnlock;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function userTotalWithdrawal(address _wallet) external view override returns (uint256) {
        return s_userTotalWithdrawal[_wallet];
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function userNextPayout(address _wallet) external view override returns (uint256) {
        return s_userNextPayout[_wallet];
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function maxPercentageWalletInvestmentLimit() external view override returns (uint256) {
        return s_maxPercentageWalletInvestmentLimit;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function minimumInvestment() external view override returns (uint256) {
        return s_minimumInvestment;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function payouts() external view override returns (Payout[] memory) {
        return s_payouts;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function payout(uint256 _index) external view override returns (Payout memory) {
        return s_payouts[_index];
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getAvailableFundsDetails(
        address _account
    ) public view returns (uint256 _amount, uint256 _carryFee, uint256 _nextUserPayoutIndex) {
        _nextUserPayoutIndex = s_userNextPayout[_account];
        uint256 nextPayoutIndex = s_nextPayoutToUnlock;

        if (_nextUserPayoutIndex >= nextPayoutIndex) {
            return (0, 0, _nextUserPayoutIndex);
        }

        for (uint256 i = _nextUserPayoutIndex; i < nextPayoutIndex; ) {
            Payout memory payoutData = s_payouts[i];
            if (payoutData.inProfit) {
                uint256 userIncomeBeforeCarryFee = _calculateUserIncomeInBlock(
                    payoutData.value,
                    _account,
                    payoutData.blockData
                );

                uint256 carryFeeSize = _getCarryFeeSize(_account, block.timestamp, payoutData.blockData.number);

                _amount +=
                    userIncomeBeforeCarryFee -
                    MathUpgradeable.mulDiv(userIncomeBeforeCarryFee, carryFeeSize, BASIS_POINT_DIVISOR);

                if (carryFeeSize > LOWEST_CARRY_FEE) {
                    carryFeeSize -= LOWEST_CARRY_FEE;
                    _carryFee += MathUpgradeable.mulDiv(userIncomeBeforeCarryFee, carryFeeSize, BASIS_POINT_DIVISOR);
                }
            } else {
                _amount += _calculateUserIncomeInBlock(payoutData.value, _account, payoutData.blockData);
            }
            unchecked {
                i++;
            }
        }
        return (_amount, _carryFee, nextPayoutIndex);
    }

    function _initializeStates() private {
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

        allowFunction(LibFund.STATE_FUNDS_IN, this.addProject.selector);
        allowFunction(LibFund.STATE_FUNDS_IN, this.removeProject.selector);

        allowFunction(LibFund.STATE_CAP_REACHED, this.addProject.selector);
        allowFunction(LibFund.STATE_CAP_REACHED, this.removeProject.selector);

        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.addProject.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.removeProject.selector);
    }

    function _invest(address _investor, uint256 _amount) private {
        uint256 fee = (uint256(_amount) * s_managementFee) / BASIS_POINT_DIVISOR;

        _transferFrom(s_currency, _investor, s_treasuryWallet, fee);
        _transferFrom(s_currency, _investor, address(this), _amount - fee);
        s_investmentNft.mint(_investor, _amount);

        emit Invested(_investor, s_currency, _amount, fee);
    }

    function _carryFeeDistribution(uint256 _carryFee) private {
        _transfer(s_currency, s_treasuryWallet, (_carryFee * 68) / 100);
        _transfer(s_currency, s_genesisNftRevenue, (_carryFee * 12) / 100);
        _transfer(s_currency, s_lpPoolAddress, (_carryFee * 99) / 1000);
        _transfer(s_currency, s_burnAddress, (_carryFee * 99) / 1000);
        _transfer(s_currency, s_communityFund, (_carryFee * 2) / 1000);
    }

    /**
     * @dev Returns carry fee in basis points for account in timestamp
     */
    function _getCarryFeeSize(
        address _account,
        uint256 _timestamp,
        uint256 _blockNumber
    ) private view returns (uint256) {
        return
            MathUpgradeable.max(
                LibFund.DEFAULT_CARRY_FEE -
                    s_stakingWlth.getDiscountFromPreviousInvestmentInTimestamp(
                        _account,
                        address(this),
                        _timestamp,
                        _blockNumber
                    ),
                1000
            );
    }

    function _calculateUserIncomeInBlock(
        uint256 _income,
        address _account,
        Block memory _blockData
    ) private view returns (uint256) {
        (uint256 userValue, uint256 totalValue) = s_investmentNft.getPastParticipation(_account, _blockData.number);
        if (totalValue > 0) {
            return (_income * userValue) / totalValue;
        } else {
            return 0;
        }
    }

    uint256[48] private __gap;
}
