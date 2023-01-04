// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IInvestmentFund.sol";
import "./IInvestmentNFT.sol";
import "./LibFund.sol";

/**
 * @title Investment Fund contract
 */
contract InvestmentFund is IInvestmentFund, ReentrancyGuard {
    string public name;
    IERC20 public currency;
    IInvestmentNFT public investmentNft;
    address public treasuryWallet;
    uint16 public managementFee;
    bytes32 public currentState = LibFund.STATE_EMPTY;
    mapping(bytes32 => mapping(bytes4 => bool)) functionsAllowed;

    /**
     * @dev Emitted when currency is changed
     * @param caller Address that changes currency
     * @param oldCurrency Old currency
     * @param newCurrency New currency
     */
    event CurrencyChanged(address indexed caller, address indexed oldCurrency, address indexed newCurrency);

    /**
     * @dev Emitted when Investment NFT contract is changed
     * @param caller Address that changes contract
     * @param oldNFT Old investment NFT contract
     * @param newNFT New investment NFT contract
     */
    event InvestmentNFTChanged(address indexed caller, address indexed oldNFT, address indexed newNFT);

    /**
     * @dev Initializes the contract by setting a `name`, `currency` and `investment NFT` to investment fund
     * @param name_ Investment fund name
     * @param currency_ Address of currency for investments
     * @param investmentNft_ Address of investment NFT contract
     */
    constructor(
        string memory name_,
        address currency_,
        address investmentNft_,
        address treasuryWallet_,
        uint16 managementFee_
    ) {
        require(currency_ != address(0), "Invalid currency address");
        require(investmentNft_ != address(0), "Invalid NFT address");
        require(treasuryWallet_ != address(0), "Invalid treasury wallet address");
        require(managementFee_ < 10000, "Invalid management fee");

        name = name_;
        currency = IERC20(currency_);
        investmentNft = IInvestmentNFT(investmentNft_);
        treasuryWallet = treasuryWallet_;
        managementFee = managementFee_;

        initializeStates();
    }

    /**
     * @dev Limits access for current state
     * @dev Only functions allowed using allowFunction are permitted
     */
    modifier onlyAllowedStates() {
        require(functionsAllowed[currentState][msg.sig], "Not allowed in current state");
        _;
    }

    /**
     * @dev Sets currency address
     * @param currency_ New currency address
     */
    function setCurrency(address currency_) external {
        address oldCurrency = address(currency);
        currency = IERC20(currency_);
        emit CurrencyChanged(msg.sender, oldCurrency, currency_);
    }

    /**
     * @dev Sets investment NFT address
     * @param nft_ New Investment NFT address
     */
    function setInvestmentNft(address nft_) external {
        address oldNFT = address(investmentNft);
        investmentNft = IInvestmentNFT(nft_);
        emit InvestmentNFTChanged(msg.sender, oldNFT, nft_);
    }

    /**
     * @inheritdoc IInvestmentFund
     */
    function invest(uint240 amount) external override onlyAllowedStates nonReentrant {
        require(amount > 0, "Invalid amount invested");

        uint256 fee = (uint256(amount) * managementFee) / LibFund.FEE_DIVISOR;
        uint256 investment = amount - fee;
        // todo: perform transition to cap reached if balance + investment = cap
        require(currency.transferFrom(msg.sender, treasuryWallet, fee), "Currency fee transfer failed");
        require(currency.transferFrom(msg.sender, address(this), investment), "Currency transfer failed");
        uint256 tokenId = investmentNft.mint(msg.sender, investment);

        emit Invested(msg.sender, address(currency), investment, tokenId);
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

    function initializeStates() internal {
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

    function allowFunction(bytes32 state, bytes4 selector) internal {
        functionsAllowed[state][selector] = true;
    }
}
