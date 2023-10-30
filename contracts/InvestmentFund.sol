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
import {BASIS_POINT_DIVISOR} from "./libraries/Constants.sol";
import {_transfer, _transferFrom} from "./libraries/Utils.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {StateMachine} from "./StateMachine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

    struct PayoutPtr {
        uint256 index;
        uint256 withdrawn;
    }

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
     * @notice List of payouts (incomes from tokens sale)
     */
    Payout[] public payouts;

    /**
     * @notice Total withdrawn amount per user
     */
    mapping(address => uint256) public userTotalWithdrawal;

    /**
     * @dev Payout recently used for withdrawal per user
     */
    mapping(address => PayoutPtr) private _currentPayout;

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
     * @param name_ Investment fund name
     * @param currency_ Address of currency for investments
     * @param investmentNft_ Address of investment NFT contract
     * @param stakingWlth_ Address of contract for staking WLTH
     * @param treasuryWallet_ Address of treasury wallet
     * @param managementFee_ Management fee in basis points
     * @param cap_ Cap value
     */
    function initialize(
        address owner_,
        string memory name_,
        address currency_,
        address investmentNft_,
        address stakingWlth_,
        address treasuryWallet_,
        address genesisNftRevenue_,
        address lpPoolAddress_,
        address burnAddress_,
        address communityFund_,
        uint16 managementFee_,
        uint256 cap_
    ) public initializer {
        __Context_init();
        __OwnablePausable_init(owner_);
        __StateMachine_init(LibFund.STATE_FUNDS_IN);
        __ReentrancyGuard_init();
        __ERC165_init();

        require(currency_ != address(0), "Invalid currency address");
        require(investmentNft_ != address(0), "Invalid NFT address");
        require(stakingWlth_ != address(0), "Invalid staking contract address");
        require(treasuryWallet_ != address(0), "Invalid treasury wallet address");
        require(managementFee_ < 10000, "Invalid management fee");
        require(cap_ > 0, "Invalid investment cap");
        require(
            IERC165Upgradeable(investmentNft_).supportsInterface(type(IInvestmentNFT).interfaceId) == true,
            "Required interface not supported"
        );

        name = name_;
        currency = currency_;
        investmentNft = investmentNft_;
        stakingWlth = IStakingWlth(stakingWlth_);
        treasuryWallet = treasuryWallet_;
        genesisNftRevenue = genesisNftRevenue_;
        lpPoolAddress = lpPoolAddress_;
        burnAddress = burnAddress_;
        communityFund = communityFund_;
        managementFee = managementFee_;
        cap = cap_;

        _initializeStates();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function invest(uint240 amount, string calldata tokenUri) external override onlyAllowedStates nonReentrant {
        require(amount > 0, "Invalid amount invested");

        uint256 newTotalInvestment = IInvestmentNFT(investmentNft).getTotalInvestmentValue() + amount;
        require(newTotalInvestment <= cap, "Total invested funds exceed cap");

        if (newTotalInvestment >= cap) {
            currentState = LibFund.STATE_CAP_REACHED;
            emit CapReached(cap);
        }

        _invest(_msgSender(), amount, tokenUri);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function withdraw(uint256 amount) external onlyAllowedStates nonReentrant {
        require(amount > 0, "Attempt to withdraw zero tokens");

        (uint256 actualAmount, uint256 carryFee, PayoutPtr memory currentPayout) = _getWithdrawalDetails(
            _msgSender(),
            amount
        );

        require(actualAmount == amount, "Withdrawal amount exceeds available funds");

        userTotalWithdrawal[_msgSender()] += amount;
        _currentPayout[_msgSender()] = currentPayout;

        emit ProfitWithdrawn(_msgSender(), currency, amount);

        _transfer(currency, _msgSender(), amount - carryFee);
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
    function getAvailableFunds(address account) public view returns (uint256) {
        uint256 availableFunds = 0;
        if (payouts.length > 0) {
            availableFunds = _getRemainingUserIncomeFromCurrentPayout(account);
            for (uint256 i = _currentPayout[account].index + 1; i < payouts.length; i++) {
                availableFunds += _getUserIncomeFromPayout(account, i);
            }
        }
        return availableFunds;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getWithdrawalCarryFee(address account, uint256 amount) external view returns (uint256) {
        require(amount <= getAvailableFunds(account), "Withdrawal amount exceeds available funds");

        (, uint256 carryFee, ) = _getWithdrawalDetails(account, amount);
        return carryFee;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function addProject(address project) external onlyAllowedStates onlyOwner {
        require(project != address(0), "Project is zero address");

        require(_projects.add(project), "Project already exists");

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
        require(_projects.remove(project), "Project does not exist");

        emit ProjectRemoved(_msgSender(), project);
    }

    function stopCollectingFunds() external onlyAllowedStates onlyOwner {
        currentState = LibFund.STATE_CAP_REACHED;
    }

    // TODO: business logic clarification with client
    function deployFunds() external onlyAllowedStates onlyOwner {
        // for (uint256 i = 0; i < _projects.length(); i++) {
        //     address project = _projects.at(i);
        //     uint256 amount = IProject(project).getFundsAllocation();
        //     require(
        //         IERC20(currency).balanceOf(address(this)) >= amount,
        //         "Not enough tokens to process the funds deployment!"
        //     );
        //     IERC20(currency).approve(project, amount);
        //     IProject(project).deployFunds(amount);
        // }
        currentState = LibFund.STATE_FUNDS_DEPLOYED;
    }

    // temporary manual deployment of funds to specified project
    /**
     * @inheritdoc IInvestmentFund
     */
    function deployFundsToProject(address project, uint256 amount) external onlyOwner {
        require(_projects.contains(project), "Project does not exist");
        require(
            IERC20(currency).balanceOf(address(this)) >= amount,
            "Not enough tokens to process the funds deployment!"
        );

        IERC20(currency).approve(project, amount);
        IProject(project).deployFunds(amount);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function provideProfit(uint256 amount) external onlyAllowedStates nonReentrant {
        require(_projects.contains(_msgSender()), "Access Denied");
        require(amount > 0, "Zero profit provided");

        Block memory blockData = Block(uint128(block.number), uint128(block.timestamp));
        uint256 carryFee = 0;
        uint256 newTotalIncome = totalIncome + amount;
        uint256 totalInvestment = IInvestmentNFT(investmentNft).getTotalInvestmentValue();

        if (totalIncome >= totalInvestment) {
            carryFee = _calculateTotalCarryFeeInBlock(amount, blockData);
            payouts.push(Payout(amount, carryFee, blockData, true));
        } else {
            if (newTotalIncome > totalInvestment) {
                uint256 profitAboveBreakeven = newTotalIncome - totalInvestment;
                carryFee = _calculateTotalCarryFeeInBlock(profitAboveBreakeven, blockData);

                payouts.push(Payout(amount - profitAboveBreakeven, 0, blockData, false));
                payouts.push(Payout(profitAboveBreakeven, carryFee, blockData, true));

                emit BreakevenReached(totalInvestment);
            } else {
                payouts.push(Payout(amount, 0, blockData, false));
                if (newTotalIncome == totalInvestment) {
                    emit BreakevenReached(totalInvestment);
                }
            }
        }
        totalIncome = newTotalIncome;

        emit ProfitProvided(address(this), amount, carryFee, blockData.number);

        if (carryFee > 0) {
            _carryFeeDistribution(carryFee);
        }
        _transferFrom(currency, _msgSender(), address(this), amount - carryFee);
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
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.withdraw.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.closeFund.selector);
    }

    function _invest(address investor, uint256 amount, string calldata tokenUri) internal {
        uint256 fee = (uint256(amount) * managementFee) / BASIS_POINT_DIVISOR;

        emit Invested(investor, currency, amount, fee);

        _transferFrom(currency, investor, treasuryWallet, fee);
        _transferFrom(currency, investor, address(this), amount - fee);
        IInvestmentNFT(investmentNft).mint(investor, amount, tokenUri);
    }

    /**
     * @dev Returns actual withdrawal amount, carry fee and new current user payout for requested withdrawal amount.
     * @dev If actual amount is lower than the requested one it means that the latter is not available.
     *
     * @param account Wallet address for which to retrieve withdrawal details
     * @param requestedAmount Amount of funds requested to withdraw
     *
     * @return actualAmount Actual amount to withdraw - requested one if available or the maximum available otherwise
     * @return carryFee Carry fee taken on withdraw
     * @return newCurrentPayout Payout index with withdrawn amount after actual amount is withdrawn
     */
    function _getWithdrawalDetails(
        address account,
        uint256 requestedAmount
    ) private view returns (uint256 actualAmount, uint256 carryFee, PayoutPtr memory newCurrentPayout) {
        uint256 payoutIndex = _currentPayout[account].index;

        uint256 fundsFromPayout = _getRemainingUserIncomeFromCurrentPayout(account);
        if (requestedAmount <= fundsFromPayout) {
            return (
                requestedAmount,
                _calculateCarryFeeFromPayout(account, payoutIndex, requestedAmount),
                PayoutPtr(payoutIndex, _currentPayout[account].withdrawn + requestedAmount)
            );
        } else {
            actualAmount = fundsFromPayout;

            while (++payoutIndex < payouts.length) {
                fundsFromPayout = _getUserIncomeFromPayout(account, payoutIndex);

                if (requestedAmount <= actualAmount + fundsFromPayout) {
                    fundsFromPayout = requestedAmount - actualAmount;
                    return (
                        requestedAmount,
                        carryFee + _calculateCarryFeeFromPayout(account, payoutIndex, fundsFromPayout),
                        PayoutPtr(payoutIndex, fundsFromPayout)
                    );
                }
                carryFee += _calculateCarryFeeFromPayout(account, payoutIndex, fundsFromPayout);
                actualAmount += fundsFromPayout;
            }
            return (actualAmount, carryFee, PayoutPtr(payoutIndex - 1, fundsFromPayout));
        }
    }

    function _getUserIncomeFromPayout(address account, uint256 payoutIndex) private view returns (uint256) {
        require(payoutIndex < payouts.length, "Payout does not exist");

        Payout memory payout = payouts[payoutIndex];
        return _calculateUserIncomeInBlock(payout.value, account, payout.blockData);
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
        require(blockNumber <= block.number, "Invalid block number");

        if (blockNumber < block.number) {
            return IInvestmentNFT(investmentNft).getPastParticipation(account, blockNumber);
        } else {
            return IInvestmentNFT(investmentNft).getParticipation(account);
        }
    }

    function _getRemainingUserIncomeFromCurrentPayout(address account) private view returns (uint256) {
        PayoutPtr memory currentPayout = _currentPayout[account];
        return _getUserIncomeFromPayout(account, currentPayout.index) - currentPayout.withdrawn;
    }

    /**
     * @dev Returns carry fee in basis points for account in timestamp
     */
    function _getCarryFeeSize(address account, uint256 timestamp) private view returns (uint256) {
        return
            MathUpgradeable.max(
                LibFund.DEFAULT_CARRY_FEE - stakingWlth.getDiscountInTimestamp(account, address(this), timestamp),
                1000
            );
    }

    /**
     * @dev Returns carry fee in timestamp according to user's income
     */
    function _calculateCarryFee(address account, uint256 timestamp, uint256 income) private view returns (uint256) {
        uint256 carryFeeSize = _getCarryFeeSize(account, timestamp);
        return MathUpgradeable.mulDiv(income, carryFeeSize, BASIS_POINT_DIVISOR);
    }

    function _calculateCarryFeeFromPayout(
        address account,
        uint256 payoutIndex,
        uint256 amount
    ) private view returns (uint256) {
        return
            (payouts[payoutIndex].inProfit && amount > 0)
                ? _calculateCarryFee(account, payouts[payoutIndex].blockData.timestamp, amount)
                : 0;
    }

    function _calculateTotalCarryFeeInBlock(uint256 income, Block memory blockData) private view returns (uint256) {
        uint256 carryFee = 0;
        address[] memory wallets = IInvestmentNFT(investmentNft).getInvestors();
        for (uint256 i = 0; i < wallets.length; i++) {
            uint256 userIncome = _calculateUserIncomeInBlock(income, wallets[i], blockData);
            carryFee += _calculateCarryFee(wallets[i], blockData.timestamp, userIncome);
        }
        return carryFee;
    }

    // TODO: ZkSync transactions batching handling?
    function _carryFeeDistribution(uint256 carryFee) internal {
        _transferFrom(currency, _msgSender(), treasuryWallet, (carryFee * 68) / 100);
        _transferFrom(currency, _msgSender(), genesisNftRevenue, (carryFee * 12) / 100);
        _transferFrom(currency, _msgSender(), lpPoolAddress, (carryFee * 99) / 1000);
        _transferFrom(currency, _msgSender(), burnAddress, (carryFee * 99) / 1000);
        _transferFrom(currency, _msgSender(), communityFund, (carryFee * 2) / 1000);
    }

    uint256[39] private __gap;
}
