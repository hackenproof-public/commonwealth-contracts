// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ERC165Upgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {IPerpetualFund} from "./interfaces/IPerpetualFund.sol";
import {IPerpetualNFT} from "./interfaces/IPerpetualNFT.sol";
import {IStakingWlth} from "./interfaces/IStakingWlth.sol";
import {LibFund} from "./libraries/LibFund.sol";
import {BASIS_POINT_DIVISOR, LOWEST_CARRY_FEE} from "./libraries/Constants.sol";
import {_transfer, _transferFrom} from "./libraries/Utils.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {StateMachine} from "./StateMachine.sol";

error PerpetualFund__NoFundsAvailable(address wallet);
error PerpetualFund__InvalidManagementFee();
error PerpetualFund__ZeroAddress();
error PerpetualFund__ZeroProfitProvided();
error PerpetualFund__InvestmentTooLow();
error PerpetualFund__OperationNotAllowed(address wallet);
error PerpetualFund__NotExistingProfit(uint256 profitId);
error PerpetualFund__ProfitToAssingExceedProvidedProfit(
    uint256 profitId,
    uint256 totalProfitToAssing,
    uint256 distributed,
    uint256 provided
);

contract PerpetualFund is OwnablePausable, IPerpetualFund, ReentrancyGuardUpgradeable, ERC165Upgradeable, StateMachine {
    using SafeERC20 for IERC20;

    uint256 private constant MAXIMUM_MANAGEMENT_FEE = 10000;
    uint256 private constant MINIMUM_CARRY_FEE = 1000;

    /**
     * @notice Management fee value
     */
    uint16 public s_managementFee;

    /**
     * @notice Address of Perpetual NFT contract
     */
    IPerpetualNFT internal s_perpetualNFT;

    /**
     * @notice Address of Staking Wlth contract
     */
    IStakingWlth public s_stakingWlth;

    /**
     * @notice Address of token collected from investors
     */
    address internal s_currency;

    /**
     * @notice Wallet collecting fees
     */
    address internal s_revenueWallet;

    /**
     * @notice Wallet collecting fees
     */
    address private s_lpPoolWallet;

    /**
     * @notice Wallet collecting fees
     */
    address private s_buybackAndBurnWallet;

    /**
     * @notice The address of the community fund
     */
    address private s_secondarySalesWallet;

    /**
     * @notice Address of profit provider
     */
    address public s_profitProvider;

    /**
     * @notice Address of funds wallet
     */
    address private s_profitGenerator;

    /**
     * @notice Address of profit component
     */
    address private s_profitDistributor;

    /**
     * @notice Total income
     */
    uint256 private s_totalIncome;

    /**
     * @notice Total withdrawal amount
     */
    uint256 private s_totalWithdrawal;

    /**
     * @notice Minimum investment value
     */
    uint256 internal s_minimumInvestment;

    /**
     * @notice Profit counter
     */
    uint256 private s_profitCounter;

    /**
     * @notice Fund name
     */
    string private s_name;

    /**
     * @notice Total withdrawn amount per user
     */
    mapping(address => uint256) private s_userTotalWithdrawal;

    /**
     * @notice The index of the next user payout
     */
    mapping(address => uint256) internal s_userNextProfitId;

    /**
     * @notice Profits
     */
    mapping(uint256 => Profit) private s_profits;

    /**
     * @notice User profits
     */
    mapping(address => UserProfit[]) s_usersProfits;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param _owner Contract owner
     * @param _currency Address of token collected from investors
     * @param _perpetualNFT Address of Perpetual NFT contract
     * @param _stakingWlth Address of Staking Wlth contract
     * @param _config Fund configuration
     * @param _profitProvider Address of profit provider
     * @param _profitGenerator Address of funds wallet
     * @param _profitDistributor Address of profit distributor
     */
    function initialize(
        address _owner,
        address _currency,
        address _perpetualNFT,
        address _stakingWlth,
        Config memory _config,
        address _profitProvider,
        address _profitGenerator,
        address _profitDistributor
    ) public initializer {
        __Context_init();
        {
            __OwnablePausable_init(_owner);
        }
        __StateMachine_init(LibFund.STATE_FUNDS_IN);
        __ReentrancyGuard_init();
        __ERC165_init();

        if (_currency == address(0)) revert PerpetualFund__ZeroAddress();
        if (_perpetualNFT == address(0)) revert PerpetualFund__ZeroAddress();
        if (_stakingWlth == address(0)) revert PerpetualFund__ZeroAddress();
        if (_config.revenueWallet == address(0)) revert PerpetualFund__ZeroAddress();
        if (_config.lpPoolWallet == address(0)) revert PerpetualFund__ZeroAddress();
        if (_config.buybackAndBurnWallet == address(0)) revert PerpetualFund__ZeroAddress();
        if (_config.secondarySalesWallet == address(0)) revert PerpetualFund__ZeroAddress();
        if (_config.managementFee >= MAXIMUM_MANAGEMENT_FEE) revert PerpetualFund__InvalidManagementFee();

        s_name = _config.name;
        s_currency = _currency;
        s_perpetualNFT = IPerpetualNFT(_perpetualNFT);
        s_stakingWlth = IStakingWlth(_stakingWlth);
        s_revenueWallet = _config.revenueWallet;
        s_lpPoolWallet = _config.lpPoolWallet;
        s_buybackAndBurnWallet = _config.buybackAndBurnWallet;
        s_secondarySalesWallet = _config.secondarySalesWallet;
        s_managementFee = _config.managementFee;
        s_minimumInvestment = _config.minimumInvestment;
        s_profitProvider = _profitProvider;
        s_profitGenerator = _profitGenerator;
        s_profitDistributor = _profitDistributor;

        _initializeStates();
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function invest(uint240 _amount) external override onlyAllowedStates nonReentrant {
        if (_amount < s_minimumInvestment) revert PerpetualFund__InvestmentTooLow();

        uint256 fee = (uint256(_amount) * s_managementFee) / BASIS_POINT_DIVISOR;

        address token = s_currency;
        _transferFrom(token, _msgSender(), s_revenueWallet, fee);
        _transferFrom(token, _msgSender(), s_profitGenerator, _amount - fee);
        s_perpetualNFT.mint(_msgSender(), _amount);

        emit Invested(_msgSender(), token, _amount, fee);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function provideProfit(uint256 _amount) external override {
        if (_msgSender() != s_profitProvider) {
            revert PerpetualFund__OperationNotAllowed(_msgSender());
        }
        if (_amount == 0) {
            revert PerpetualFund__ZeroProfitProvided();
        }

        IPerpetualNFT(address(s_perpetualNFT)).enableSplitting(false);

        uint256 currentProfitIndex = s_profitCounter;
        s_profits[currentProfitIndex] = Profit(currentProfitIndex, _amount, 0, block.number);

        currentProfitIndex++;
        s_profitCounter = currentProfitIndex;
        s_totalIncome += _amount;

        emit ProfitProvided(currentProfitIndex - 1, _amount, block.number);

        _transferFrom(s_currency, _msgSender(), address(this), _amount);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function distributeProfit(uint256 profitId, UnassignedProfit[] memory profits) external override {
        if (_msgSender() != s_profitDistributor) {
            revert PerpetualFund__OperationNotAllowed(msg.sender);
        }
        if (profitId >= s_profitCounter) {
            revert PerpetualFund__NotExistingProfit(profitId);
        }

        uint256 totalProfitToAssign;
        for (uint256 i; i < profits.length; ) {
            totalProfitToAssign += profits[i].notSubjectedToCarryFee + profits[i].subjectedToCarryFee;
            unchecked {
                i++;
            }
        }

        Profit memory profit = s_profits[profitId];
        if (totalProfitToAssign + profit.distributed > profit.provided) {
            revert PerpetualFund__ProfitToAssingExceedProvidedProfit(
                profitId,
                totalProfitToAssign,
                profit.distributed,
                profit.provided
            );
        }

        for (uint256 i; i < profits.length; ) {
            s_usersProfits[profits[i].wallet].push(
                UserProfit(profitId, false, profits[i].notSubjectedToCarryFee, profits[i].subjectedToCarryFee)
            );
            emit ProfitDistributed(
                profitId,
                profits[i].wallet,
                profits[i].notSubjectedToCarryFee,
                profits[i].subjectedToCarryFee
            );
            unchecked {
                i++;
            }
        }

        s_profits[profitId].distributed += totalProfitToAssign;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function withdraw() external override nonReentrant {
        (uint256 amount, uint256 carryFee, uint256 userProfitStartIndex) = getAvailableFundsDetails(_msgSender());

        if (amount == 0) {
            revert PerpetualFund__NoFundsAvailable(_msgSender());
        }

        s_userTotalWithdrawal[_msgSender()] += amount;
        s_userNextProfitId[_msgSender()] = userProfitStartIndex + 1;

        s_totalWithdrawal += amount + carryFee;

        if (carryFee > 0) {
            _carryFeeDistribution(carryFee);
        }

        _transfer(s_currency, _msgSender(), amount);

        emit ProfitWithdrawn(_msgSender(), amount);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function setStakingWlth(address _stakingWlth) external override onlyOwner {
        if (_stakingWlth == address(0)) {
            revert PerpetualFund__ZeroAddress();
        }

        s_stakingWlth = IStakingWlth(_stakingWlth);
        emit StakingWlthSet(_stakingWlth);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function setMinimumInvestment(uint256 _minimumInvestment) external override onlyOwner {
        s_minimumInvestment = _minimumInvestment;
        emit MinimumInvestmentSet(_minimumInvestment);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function setProfitProvider(address _profitProvider) external override onlyOwner {
        if (_profitProvider == address(0)) revert PerpetualFund__ZeroAddress();
        s_profitProvider = _profitProvider;
        emit ProfitProviderSet(_profitProvider);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function setBuybackAndBurnAddress(address _burnAddress) external override onlyOwner {
        if (_burnAddress == address(0)) revert PerpetualFund__ZeroAddress();
        s_buybackAndBurnWallet = _burnAddress;
        emit BuybackAndBurnAddressSet(_burnAddress);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function closeFund() external override onlyAllowedStates onlyOwner {
        currentState = LibFund.STATE_CLOSED;
        emit FundClosed();
    }

    function getAvailableFundsDetails(
        address _account
    ) public view override returns (uint256 amount, uint256 carryFee, uint256 userProfitStartIndex) {
        userProfitStartIndex = s_userNextProfitId[_account];

        UserProfit[] memory userProfits = s_usersProfits[_account];

        if (userProfits.length == 0) {
            return (0, 0, userProfitStartIndex);
        }

        for (uint256 i = userProfitStartIndex; i < userProfits.length; ) {
            Profit memory profitData = s_profits[userProfits[i].profitId];

            uint256 carryFeeSize = _getCarryFeeSize(_account, block.timestamp, profitData.blockNumber);

            carryFee = MathUpgradeable.mulDiv(userProfits[i].subjectedToCarryFee, carryFeeSize, BASIS_POINT_DIVISOR);

            amount += userProfits[i].nonSubjectedToCarryFee + userProfits[i].subjectedToCarryFee - carryFee;

            unchecked {
                i++;
            }
        }
        return (amount, carryFee, userProfitStartIndex);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function getDetails() external view returns (Details memory) {
        return
            Details(
                s_name,
                s_currency,
                address(s_perpetualNFT),
                s_revenueWallet,
                s_lpPoolWallet,
                s_buybackAndBurnWallet,
                s_secondarySalesWallet,
                s_managementFee,
                s_perpetualNFT.getTotalInvestmentValue(),
                s_totalIncome,
                s_minimumInvestment
            );
    }

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return _interfaceId == type(IPerpetualFund).interfaceId || super.supportsInterface(_interfaceId);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function name() external view override returns (string memory) {
        return s_name;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function currency() external view override returns (address) {
        return s_currency;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function perpetualNFT() external view override returns (address) {
        return address(s_perpetualNFT);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function stakingWlth() external view override returns (address) {
        return address(s_stakingWlth);
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function revenueWallet() external view override returns (address) {
        return s_revenueWallet;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function lpPoolWallet() external view override returns (address) {
        return s_lpPoolWallet;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function buybackAndBurnWallet() external view override returns (address) {
        return s_buybackAndBurnWallet;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function secondarySalesWallet() external view override returns (address) {
        return s_secondarySalesWallet;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function managementFee() external view override returns (uint16) {
        return s_managementFee;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function totalIncome() external view override returns (uint256) {
        return s_totalIncome;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function userTotalWithdrawal(address _wallet) external view override returns (uint256) {
        return s_userTotalWithdrawal[_wallet];
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function minimumInvestment() external view override returns (uint256) {
        return s_minimumInvestment;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function profitProvider() external view override returns (address) {
        return s_profitProvider;
    }

    //dodac do interfejsu

    /**
     * @inheritdoc IPerpetualFund
     */
    function profitDistributor() external view override returns (address) {
        return s_profitDistributor;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function profitGenerator() external view override returns (address) {
        return s_profitGenerator;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function getProfit(uint256 _profitId) external view override returns (Profit memory) {
        return s_profits[_profitId];
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function getProfitCounter() external view override returns (uint256) {
        return s_profitCounter;
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function getUserProfits(address _account) external view override returns (UserProfit[] memory) {
        return s_usersProfits[_account];
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function nextUserProfitId(address _account) external view override returns (uint256) {
        return s_userNextProfitId[_account];
    }

    /**
     * @inheritdoc IPerpetualFund
     */
    function totalWithdrawal() external view override returns (uint256) {
        return s_totalWithdrawal;
    }

    function _initializeStates() private {
        allowFunction(LibFund.STATE_FUNDS_IN, this.invest.selector);
        allowFunction(LibFund.STATE_FUNDS_IN, this.closeFund.selector);
    }

    function _carryFeeDistribution(uint256 _carryFee) private {
        _transfer(s_currency, s_revenueWallet, (_carryFee * 80) / 100);
        _transfer(s_currency, s_lpPoolWallet, (_carryFee * 99) / 1000);
        _transfer(s_currency, s_buybackAndBurnWallet, (_carryFee * 99) / 1000);
        _transfer(s_currency, s_secondarySalesWallet, (_carryFee * 2) / 1000);
    }

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
                LibFund.MINIMUM_CARRY_FEE
            );
    }

    uint256[48] private __gap;
}
