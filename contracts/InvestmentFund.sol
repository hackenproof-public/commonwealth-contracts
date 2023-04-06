// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC165, IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IInvestmentFund} from "./interfaces/IInvestmentFund.sol";
import {IInvestmentNFT} from "./interfaces/IInvestmentNFT.sol";
import {IProject} from "./interfaces/IProject.sol";
import {LibFund} from "./libraries/LibFund.sol";
import {StateMachine} from "./StateMachine.sol";

/**
 * @title Investment Fund contract
 */
contract InvestmentFund is StateMachine, IInvestmentFund, ReentrancyGuard, ERC165 {
    using EnumerableSet for EnumerableSet.AddressSet;

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
    IERC20 public currency;

    /**
     * @notice Address of Investment NFT contract
     */
    IInvestmentNFT public investmentNft;

    /**
     * @notice Wallet collecting fees
     */
    address public treasuryWallet;

    /**
     * @notice Management fee value
     */
    uint16 public managementFee;

    /**
     * @notice Fund capacity above which collecting funds is stopped
     */
    uint256 public cap;

    /**
     * @notice Total invested funds
     */
    uint256 public totalInvestment;

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
    EnumerableSet.AddressSet private _projects;

    /**
     * @dev Initializes the contract
     * @param name_ Investment fund name
     * @param currency_ Address of currency for investments
     * @param investmentNft_ Address of investment NFT contract
     * @param treasuryWallet_ Address of treasury wallet
     * @param managementFee_ Management fee in basis points
     * @param cap_ Cap value
     */
    constructor(
        string memory name_,
        address currency_,
        address investmentNft_,
        address treasuryWallet_,
        uint16 managementFee_,
        uint256 cap_
    ) StateMachine(LibFund.STATE_FUNDS_IN) {
        require(currency_ != address(0), "Invalid currency address");
        require(investmentNft_ != address(0), "Invalid NFT address");
        require(treasuryWallet_ != address(0), "Invalid treasury wallet address");
        require(managementFee_ < 10000, "Invalid management fee");
        require(cap_ > 0, "Invalid investment cap");
        require(
            IERC165(investmentNft_).supportsInterface(type(IInvestmentNFT).interfaceId) == true,
            "Required interface not supported"
        );

        name = name_;
        currency = IERC20(currency_);
        investmentNft = IInvestmentNFT(investmentNft_);
        treasuryWallet = treasuryWallet_;
        managementFee = managementFee_;
        cap = cap_;

        _initializeStates();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function invest(uint240 amount) external override onlyAllowedStates nonReentrant {
        require(amount > 0, "Invalid amount invested");

        uint256 newTotalInvestment = totalInvestment + amount;
        require(newTotalInvestment <= cap, "Total invested funds exceed cap");

        if (newTotalInvestment >= cap) {
            currentState = LibFund.STATE_CAP_REACHED;
            emit CapReached(cap);
        }

        totalInvestment = newTotalInvestment;

        _invest(msg.sender, amount);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function withdraw(uint256 amount) external onlyAllowedStates nonReentrant {
        require(amount > 0, "Attempt to withdraw zero tokens");

        (uint256 actualAmount, uint256 carryFee, PayoutPtr memory currentPayout) = _getWithdrawalDetails(
            msg.sender,
            amount
        );

        require(actualAmount == amount, "Withdrawal amount exceeds available funds");

        userTotalWithdrawal[msg.sender] += amount;
        _currentPayout[msg.sender] = currentPayout;

        emit ProfitWithdrawn(msg.sender, address(currency), amount);

        _transfer(currency, msg.sender, amount - carryFee);
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
    function getAvailableFunds(address account) external view returns (uint256) {
        uint256 availableFunds = _getRemainingUserIncomeFromCurrentPayout(account);
        for (uint256 i = _currentPayout[account].index + 1; i < payouts.length; i++) {
            availableFunds += _getUserIncomeFromPayout(account, i);
        }
        return availableFunds;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getWithdrawalCarryFee(address account, uint256 amount) external view returns (uint256) {
        (uint256 actualAmount, uint256 carryFee, ) = _getWithdrawalDetails(account, amount);
        require(actualAmount == amount, "Withdrawal amount exceeds available funds");
        return carryFee;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function addProject(address project) external onlyAllowedStates {
        // TODO: limit role access
        require(project != address(0), "Project is zero address");

        require(_projects.add(project), "Project already exists");

        emit ProjectAdded(msg.sender, project);
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
    function removeProject(address project) external onlyAllowedStates {
        // TODO: limit role access
        require(_projects.remove(project), "Project does not exist");

        emit ProjectRemoved(msg.sender, project);
    }

    function stopCollectingFunds() external onlyAllowedStates {
        // TODO: limit role access
        currentState = LibFund.STATE_CAP_REACHED;
    }

    function deployFunds() external onlyAllowedStates {
        // TODO: limit role access
        currentState = LibFund.STATE_FUNDS_DEPLOYED;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function provideProfit(uint256 amount) external onlyAllowedStates nonReentrant {
        // TODO: limit role access
        require(amount > 0, "Zero profit provided");

        uint256 blockNumber = block.number;
        uint256 carryFee = 0;
        uint256 newTotalIncome = totalIncome + amount;

        if (isInProfit()) {
            carryFee = _calculateTotalCarryFeeInBlock(amount, blockNumber);
            payouts.push(Payout(amount, carryFee, uint248(blockNumber), true));
        } else {
            if (newTotalIncome > totalInvestment) {
                uint256 profitAboveBreakeven = newTotalIncome - totalInvestment;
                carryFee = _calculateTotalCarryFeeInBlock(profitAboveBreakeven, blockNumber);

                payouts.push(Payout(amount - profitAboveBreakeven, 0, uint248(blockNumber), false));
                payouts.push(Payout(profitAboveBreakeven, carryFee, uint248(blockNumber), true));

                emit BreakevenReached(totalInvestment);
            } else {
                payouts.push(Payout(amount, 0, uint248(blockNumber), false));
                if (newTotalIncome == totalInvestment) {
                    emit BreakevenReached(totalInvestment);
                }
            }
        }
        totalIncome = newTotalIncome;

        emit ProfitProvided(address(this), amount, carryFee, block.number);

        if (carryFee > 0) {
            _transferFrom(currency, msg.sender, treasuryWallet, carryFee);
        }
        _transferFrom(currency, msg.sender, address(this), amount - carryFee);
    }

    function closeFund() external onlyAllowedStates {
        // TODO: limit role access
        currentState = LibFund.STATE_CLOSED;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function isInProfit() public view returns (bool) {
        return totalIncome >= totalInvestment;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function getDetails() external view returns (Details memory) {
        return
            Details(
                name,
                address(currency),
                address(investmentNft),
                treasuryWallet,
                managementFee,
                cap,
                totalInvestment,
                totalIncome,
                payouts,
                currentState
            );
    }

    /**
     * @inheritdoc IERC165
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
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.provideProfit.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.withdraw.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.closeFund.selector);
    }

    function _invest(address investor, uint256 amount) internal {
        uint256 fee = (uint256(amount) * managementFee) / LibFund.BASIS_POINT_DIVISOR;

        emit Invested(investor, address(currency), amount, fee);

        _transferFrom(currency, investor, treasuryWallet, fee);
        _transferFrom(currency, investor, address(this), amount - fee);
        investmentNft.mint(investor, amount);
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
        return _calculateUserIncomeInBlock(payout.value, account, payout.blockNumber);
    }

    function _calculateUserIncomeInBlock(
        uint256 income,
        address account,
        uint256 blockNumber
    ) private view returns (uint256) {
        (uint256 userValue, uint256 totalValue) = _getUserParticipationInFund(account, blockNumber);
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
            return investmentNft.getUserParticipationInBlock(account, blockNumber);
        } else {
            return investmentNft.getUserParticipation(account);
        }
    }

    function _getRemainingUserIncomeFromCurrentPayout(address account) private view returns (uint256) {
        PayoutPtr memory currentPayout = _currentPayout[account];
        return _getUserIncomeFromPayout(account, currentPayout.index) - currentPayout.withdrawn;
    }

    function _getCarryFeeDiscount(address /* account */, uint256 /* blockNumber */) private pure returns (uint256) {
        // carry fee will be calculated based on account staking conditions
        return 0;
    }

    function _getCarryFee(address account, uint256 blockNumber) private pure returns (uint256) {
        return LibFund.DEFAULT_CARRY_FEE - _getCarryFeeDiscount(account, blockNumber);
    }

    function _calculateCarryFeeInBlock(
        address account,
        uint256 blockNumber,
        uint256 amount
    ) private pure returns (uint256) {
        uint256 carryFee = _getCarryFee(account, blockNumber);
        return Math.mulDiv(amount, carryFee, LibFund.BASIS_POINT_DIVISOR);
    }

    function _calculateCarryFeeFromPayout(
        address account,
        uint256 payoutIndex,
        uint256 amount
    ) private view returns (uint256) {
        return
            (payouts[payoutIndex].inProfit && amount > 0)
                ? _calculateCarryFeeInBlock(account, payouts[payoutIndex].blockNumber, amount)
                : 0;
    }

    function _calculateTotalCarryFeeInBlock(uint256 income, uint256 blockNumber) private view returns (uint256) {
        uint256 carryFee = 0;
        address[] memory wallets = investmentNft.getWallets();
        for (uint256 i = 0; i < wallets.length; i++) {
            uint256 userIncome = _calculateUserIncomeInBlock(income, wallets[i], blockNumber);
            carryFee += _calculateCarryFeeInBlock(wallets[i], blockNumber, userIncome);
        }
        return carryFee;
    }

    function _transferFrom(IERC20 erc20Token, address from, address to, uint256 amount) private {
        require(erc20Token.transferFrom(from, to, amount), "Currency transfer failed");
    }

    function _transfer(IERC20 erc20Token, address to, uint256 amount) private {
        require(erc20Token.transfer(to, amount), "Currency transfer failed");
    }
}
