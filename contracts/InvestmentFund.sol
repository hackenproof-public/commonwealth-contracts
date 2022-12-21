// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./IInvestmentFund.sol";
import "./IInvestmentNFT.sol";
import "hardhat/console.sol";

contract InvestmentFund is IInvestmentFund {
    event Invested(address indexed investor, address indexed currency, uint256 indexed amount, uint256 tokenId);
    event CurrencyChanged(address indexed caller, address indexed oldCurrency, address indexed newCurrency);
    event InvestmentNFTChanged(address indexed caller, address indexed oldNFT, address indexed newNFT);

    string public name;
    IERC20 public currency;
    IInvestmentNFT public investmentNft;

    constructor(string memory name_, address currency_, address investmentNft_) {
        require(currency_ != address(0), "Invalid currency address");
        require(investmentNft_ != address(0), "Invalid NFT address");

        name = name_;
        currency = IERC20(currency_);
        investmentNft = IInvestmentNFT(investmentNft_);
    }

    function setCurrency(address currency_) external {
        address oldCurrency = address(currency);
        currency = IERC20(currency_);
        emit CurrencyChanged(msg.sender, oldCurrency, currency_);
    }

    function setInvestmentNft(address investmentNft_) external {
        address oldNFT = address(investmentNft);
        investmentNft = IInvestmentNFT(investmentNft_);
        emit InvestmentNFTChanged(msg.sender, oldNFT, investmentNft_);
    }

    function invest(uint256 amount) external override { // todo: uint240 (to handle multiplication for managment fee calculation)
        require(amount > 0, "Invalid amount invested");

        require(currency.transferFrom(msg.sender, address(this), amount), "Currency transfer failed");
        uint256 tokenId = investmentNft.mint(msg.sender, amount);

        emit Invested(msg.sender, address(currency), amount, tokenId);
    }
}
