// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./IInvestmentFund.sol";
import "./IInvestmentNFT.sol";

/**
 * @title Investment Fund contract
 */
contract InvestmentFund is IInvestmentFund, ReentrancyGuard {
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

    string public name;
    IERC20 public currency;
    IInvestmentNFT public investmentNft;

    /**
     * @dev Initializes the contract by setting a `name`, `currency` and `investment NFT` to investment fund
     * @param name_ Investment fund name
     * @param currency_ Address of currency for investments
     * @param investmentNft_ Address of investment NFT contract
     */
    constructor(string memory name_, address currency_, address investmentNft_) {
        require(currency_ != address(0), "Invalid currency address");
        require(investmentNft_ != address(0), "Invalid NFT address");

        name = name_;
        currency = IERC20(currency_);
        investmentNft = IInvestmentNFT(investmentNft_);
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
    function invest(uint256 amount) external override nonReentrant {
        require(amount > 0, "Invalid amount invested");

        require(currency.transferFrom(msg.sender, address(this), amount), "Currency transfer failed");
        uint256 tokenId = investmentNft.mint(msg.sender, amount);

        emit Invested(msg.sender, address(currency), amount, tokenId);
    }
}
