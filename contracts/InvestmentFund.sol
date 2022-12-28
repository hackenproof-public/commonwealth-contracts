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
    uint256 public constant FEE_DIVISOR = 10000;

    string public name;
    IERC20 public currency;
    IInvestmentNFT public investmentNft;
    address public treasuryWallet;
    uint16 public managementFee;

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
    function invest(uint240 amount) external override nonReentrant {
        require(amount > 0, "Invalid amount invested");

        uint256 fee = (uint256(amount) * managementFee) / FEE_DIVISOR;
        uint256 investment = amount - fee;
        require(currency.transferFrom(msg.sender, treasuryWallet, fee), "Currency fee transfer failed");
        require(currency.transferFrom(msg.sender, address(this), investment), "Currency transfer failed");
        uint256 tokenId = investmentNft.mint(msg.sender, investment);

        emit Invested(msg.sender, address(currency), investment, tokenId);
    }
}
