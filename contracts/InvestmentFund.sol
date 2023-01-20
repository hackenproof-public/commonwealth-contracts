// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IInvestmentFund.sol";
import "./IInvestmentNFT.sol";
import "./LibFund.sol";
import "./StateMachine.sol";

/**
 * @title Investment Fund contract
 */
contract InvestmentFund is StateMachine, IInvestmentFund, ReentrancyGuard {
    string public name;
    IERC20 public currency;
    IInvestmentNFT public investmentNft;
    address public treasuryWallet;
    uint16 public managementFee;
    uint256 public cap;
    uint256 public totalInvestment;

    /**
     * @dev Initializes the contract
     * @param name_ Investment fund name
     * @param currency_ Address of currency for investments
     * @param investmentNft_ Address of investment NFT contract
     * @param treasuryWallet_ Address of treasury wallet
     * @param managementFee_ Management fee value
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

        name = name_;
        currency = IERC20(currency_);
        investmentNft = IInvestmentNFT(investmentNft_);
        treasuryWallet = treasuryWallet_;
        managementFee = managementFee_;
        cap = cap_;
        totalInvestment = 0;

        _initializeStates();
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function invest(uint240 amount) external override onlyAllowedStates nonReentrant {
        require(amount > 0, "Invalid amount invested");

        uint256 fee = (uint256(amount) * managementFee) / LibFund.FEE_DIVISOR;
        uint256 investment = amount - fee;
        uint256 newTotalInvestment = totalInvestment + investment;
        require(newTotalInvestment <= cap, "Total invested funds exceed cap");

        totalInvestment = newTotalInvestment;

        if (newTotalInvestment >= cap) {
            currentState = LibFund.STATE_CAP_REACHED;
            emit CapReached(msg.sender, address(currency), investment, cap);
        }

        _invest(msg.sender, investment, fee);
    }

    function addProject() external onlyAllowedStates {
        // todo: limit access
    }

    function startCollectingFunds() external onlyAllowedStates {
        // todo: limit access
        currentState = LibFund.STATE_FUNDS_IN;
    }

    function stopCollectingFunds() external onlyAllowedStates {
        // todo: limit access
        currentState = LibFund.STATE_CAP_REACHED;
    }

    function deployFunds() external onlyAllowedStates {
        // todo: limit access
        currentState = LibFund.STATE_FUNDS_DEPLOYED;
    }

    function activateFund() external onlyAllowedStates {
        // todo: limit access
        currentState = LibFund.STATE_ACTIVE;
    }

    function provideProfits() external onlyAllowedStates {
        // todo: limit access
        // todo: if breakeven reached go to Breakeven state
    }

    function closeFund() external onlyAllowedStates {
        // todo: limit access
        currentState = LibFund.STATE_CLOSED;
    }

    function _initializeStates() internal {
        allowFunction(LibFund.STATE_EMPTY, this.addProject.selector);
        allowFunction(LibFund.STATE_EMPTY, this.startCollectingFunds.selector);
        allowFunction(LibFund.STATE_FUNDS_IN, this.invest.selector);
        allowFunction(LibFund.STATE_FUNDS_IN, this.stopCollectingFunds.selector);
        allowFunction(LibFund.STATE_CAP_REACHED, this.deployFunds.selector);
        allowFunction(LibFund.STATE_FUNDS_DEPLOYED, this.activateFund.selector);
        allowFunction(LibFund.STATE_ACTIVE, this.provideProfits.selector);
        allowFunction(LibFund.STATE_ACTIVE, this.closeFund.selector);
        allowFunction(LibFund.STATE_BREAKEVEN, this.provideProfits.selector);
        allowFunction(LibFund.STATE_BREAKEVEN, this.closeFund.selector);
    }

    function _invest(address investor, uint256 value, uint256 fee) internal {
        emit Invested(msg.sender, address(currency), value, fee);

        require(currency.transferFrom(investor, treasuryWallet, fee), "Currency fee transfer failed");
        require(currency.transferFrom(investor, address(this), value), "Currency transfer failed");
        investmentNft.mint(investor, value);
    }
}
