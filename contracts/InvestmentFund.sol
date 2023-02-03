// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./interfaces/IInvestmentFund.sol";
import "./interfaces/IInvestmentNFT.sol";
import "./LibFund.sol";
import "./StateMachine.sol";

/**
 * @title Investment Fund contract
 */
contract InvestmentFund is StateMachine, IInvestmentFund, ReentrancyGuard, ERC165 {
    struct PayoutPtr {
        uint256 index;
        uint256 withdrawn;
    }

    string public name;
    IERC20 public currency;
    IInvestmentNFT public investmentNft;
    address public treasuryWallet;
    uint16 public managementFee;
    uint256 public cap;
    uint256 public totalInvestment;
    uint256 public totalIncome;

    Payout[] public payouts;
    mapping(address => uint256) public userTotalWithdrawal; // maps account into total withdrawal amount

    mapping(address => PayoutPtr) private _currentPayout; // maps account into payout recently used for withdrawal

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
    ) StateMachine(LibFund.STATE_EMPTY) {
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

        if (carryFee > 0) {
            _transfer(currency, treasuryWallet, carryFee);
        }
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
        uint256 availableFunds = _getRemainingFundsFromRecentPayout(account);
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

    function addProject() external onlyAllowedStates {
        // TODO: limit role access
    }

    function startCollectingFunds() external onlyAllowedStates {
        // TODO: limit role access
        currentState = LibFund.STATE_FUNDS_IN;
    }

    function stopCollectingFunds() external onlyAllowedStates {
        // TODO: limit role access
        currentState = LibFund.STATE_CAP_REACHED;
    }

    function deployFunds() external onlyAllowedStates {
        // TODO: limit role access
        currentState = LibFund.STATE_FUNDS_DEPLOYED;
    }

    function activateFund() external onlyAllowedStates {
        // TODO: limit role access
        currentState = LibFund.STATE_ACTIVE;
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function provideProfit(uint256 amount) external onlyAllowedStates nonReentrant {
        // TODO: limit role access
        require(amount > 0, "Zero profit provided");

        uint256 newTotalIncome = totalIncome + amount;

        if (isInProfit()) {
            payouts.push(Payout(amount, uint248(block.number), true));
        } else {
            if (newTotalIncome > totalInvestment) {
                emit BreakevenReached(totalInvestment);
                uint256 profitAboveBreakeven = newTotalIncome - totalInvestment;
                payouts.push(Payout(amount - profitAboveBreakeven, uint248(block.number), false));
                payouts.push(Payout(profitAboveBreakeven, uint248(block.number), true));
            } else {
                payouts.push(Payout(amount, uint248(block.number), false));
                if (newTotalIncome == totalInvestment) {
                    emit BreakevenReached(totalInvestment);
                }
            }
        }

        totalIncome = newTotalIncome;

        emit ProfitProvided(address(this), amount, block.number);

        _transferFrom(currency, msg.sender, address(this), amount);
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

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IInvestmentFund).interfaceId || super.supportsInterface(interfaceId);
    }

    function _initializeStates() internal {
        allowFunction(LibFund.STATE_EMPTY, this.addProject.selector);
        allowFunction(LibFund.STATE_EMPTY, this.startCollectingFunds.selector);
        allowFunction(LibFund.STATE_FUNDS_IN, this.invest.selector);
        allowFunction(LibFund.STATE_FUNDS_IN, this.stopCollectingFunds.selector);
        allowFunction(LibFund.STATE_CAP_REACHED, this.deployFunds.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.activateFund.selector);
        allowFunction(LibFund.STATE_ACTIVE, this.provideProfit.selector);
        allowFunction(LibFund.STATE_ACTIVE, this.withdraw.selector);
        allowFunction(LibFund.STATE_ACTIVE, this.closeFund.selector);
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

        uint256 fundsFromPayout = _getRemainingFundsFromRecentPayout(account);
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
        require(payout.blockNumber <= block.number, "Invalid payout block number");

        return _calculateUserIncomeInBlock(payout.value, account, payout.blockNumber);
    }

    function _calculateUserIncomeInBlock(
        uint256 value,
        address account,
        uint256 blockNumber
    ) private view returns (uint256) {
        uint256 totalInvestmentInBlock = (blockNumber < block.number)
            ? investmentNft.getPastTotalInvestmentValue(blockNumber)
            : investmentNft.getTotalInvestmentValue();

        if (totalInvestmentInBlock != 0) {
            uint256 walletInvestmentInBlock = (blockNumber < block.number)
                ? investmentNft.getPastInvestmentValue(account, blockNumber)
                : investmentNft.getInvestmentValue(account);

            return (value * walletInvestmentInBlock) / totalInvestmentInBlock;
        } else {
            return 0;
        }
    }

    function _getRemainingFundsFromRecentPayout(address account) private view returns (uint256) {
        PayoutPtr memory currentPayout = _currentPayout[account];
        return _getUserIncomeFromPayout(account, currentPayout.index) - currentPayout.withdrawn;
    }

    function _getCarryFeeDiscount(address /* account */, uint256 /* blockNumber */) private pure returns (uint256) {
        // carry fee will be calculated based on account staking conditions
        return 0;
    }

    function _calculateCarryFee(address account, uint256 blockNumber, uint256 amount) private pure returns (uint256) {
        uint256 carryFee = LibFund.DEFAULT_CARRY_FEE - _getCarryFeeDiscount(account, blockNumber);
        return (carryFee * amount) / LibFund.BASIS_POINT_DIVISOR;
    }

    function _calculateCarryFeeFromPayout(
        address account,
        uint256 payoutIndex,
        uint256 amount
    ) private view returns (uint256) {
        return
            (payouts[payoutIndex].inProfit && amount > 0)
                ? _calculateCarryFee(account, payouts[payoutIndex].blockNumber, amount)
                : 0;
    }

    function _transferFrom(IERC20 erc20Token, address from, address to, uint256 amount) private {
        require(erc20Token.transferFrom(from, to, amount), "Currency transfer failed");
    }

    function _transfer(IERC20 erc20Token, address to, uint256 amount) private {
        require(erc20Token.transfer(to, amount), "Currency transfer failed");
    }
}
