// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {IERC20Upgradeable, SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {IERC721Mintable} from "./interfaces/IERC721Mintable.sol";

/**
 * @title Crowdsale
 * @dev Crowdsale is a base contract for managing a token crowdsale,
 * allowing investors to purchase tokens with proper currency.
 */
contract Crowdsale is OwnableUpgradeable, PausableUpgradeable {
    using SafeCastUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct Whitelist {
        uint128 cap;
        uint128 contribution;
    }

    struct Tranche {
        uint256 price;
        uint64 publicSupply;
        uint64 publicSold;
        uint64 whitelistedSupply;
        uint64 whitelistedSold;
    }

    uint256 public constant TOKEN_LIMIT_PER_PURCHASE = 100;

    /**
     * @notice The token being sold
     */
    address public token;

    /**
     * @notice The token received for sold token
     */
    IERC20Upgradeable public currency;

    /**
     * @notice Address which collects raised funds
     */
    address public wallet;

    /**
     * @notice URI of token metadata
     */
    string public tokenUri;

    /**
     * @notice List of tranches
     */
    mapping(uint256 => Tranche) public tranches;

    /**
     * @notice Index of current tranche
     */
    uint256 private currentTranche;

    mapping(uint256 => mapping(address => Whitelist)) private _whitelists;

    /**
     * @notice Emitted when tokens are purchased
     * @param beneficiary Address that bought NFT
     * @param value Total value paid for NFTs
     * @param amount Amuont of NFTs transfered
     */
    event TokensPurchased(address indexed beneficiary, uint256 value, uint256 amount);

    /**
     * @notice Emitted when new tranche is added
     * @param index Index of new tranche
     * @param supply Token supply within new tranche
     * @param price Price per token
     */
    event TrancheAdded(uint256 indexed index, uint256 indexed supply, uint256 indexed price);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @param owner_ Address of crowdsale contract owner
     * @param wallet_ Address where collected funds will be forwarded to
     * @param currency_ Address of the token received for NFT
     * @param token_ Address of the token being sold
     * @param initialSupply_ Number of tokens intended for open sale
     * @param price_ Price per token in `currency`
     * @param tokenUri_ URI of token metadata
     */
    function initialize(
        address owner_,
        address wallet_,
        IERC20Upgradeable currency_,
        address token_,
        uint64 initialSupply_,
        uint256 price_,
        string memory tokenUri_
    ) public initializer {
        __Context_init();
        __Ownable_init();
        __Pausable_init();

        require(owner_ != address(0), "Owner is the zero address");
        require(wallet_ != address(0), "Wallet is the zero address");
        require(token_ != address(0), "Token is the zero address");

        transferOwnership(owner_);

        wallet = wallet_;
        currency = currency_;
        token = token_;
        tokenUri = tokenUri_;

        if (initialSupply_ > 0) {
            require(price_ > 0, "Invalid price");
            address[] memory accounts;
            uint256[] memory caps;
            _setupTranche(currentTranche, Tranche(price_, initialSupply_, 0, 0, 0), accounts, caps);
        }

        _pause();
    }

    /**
     * @notice Changes fundraising wallet to new address
     * @param newWallet New fundraising wallet address
     */
    function setWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Wallet is the zero address");
        wallet = newWallet;
    }

    /**
     * @notice Changes currency to new address
     * @param newCurrency New currency address
     */
    function setCurrency(address newCurrency) external onlyOwner {
        require(newCurrency != address(0), "Currency is the zero address");
        currency = IERC20Upgradeable(newCurrency);
    }

    /**
     * @notice Changes token address
     * @param newToken New token address
     */
    function setToken(address newToken) external onlyOwner {
        require(newToken != address(0), "Token is the zero address");
        token = newToken;
    }

    /**
     * @notice Changes token URI
     * @param newTokenUri New token URI
     */
    function setTokenUri(string calldata newTokenUri) external onlyOwner {
        tokenUri = newTokenUri;
    }

    /**
     * @notice Pauses crowdsale - disables all transfer operations
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses crowdsale - enables all transfer operations
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @notice Returns total raised funds throughout all tranches
     * @return Total raised funds
     */
    function fundsRaised() external view returns (uint256) {
        uint256 raised = 0;
        uint256 tranchesCount = getTranchesCount();
        for (uint256 i = 0; i < tranchesCount; i++) {
            Tranche memory tranche = tranches[i];
            uint256 tokensSold = tranche.publicSold + tranche.whitelistedSold;
            raised += (tokensSold * tranche.price);
        }
        return raised;
    }

    /**
     * @notice Performs NFT purchase transaction. Transfers currency tokens to wallet and mints `amount` NFTs to purchaser.
     * @param amount Amount of tokens to buy
     */
    function buyTokens(uint256 amount) external whenNotPaused {
        require(amount > 0, "Invalid token amount claimed");
        require(amount <= available(_msgSender()), "Too many tokens claimed");
        require(amount <= TOKEN_LIMIT_PER_PURCHASE, "Too many tokens claimed");

        _processPurchase(_msgSender(), amount);
    }

    /**
     * @notice Returns number of tranches used so far
     * @return Number of tranches
     */
    function getTranchesCount() public view returns (uint256) {
        return currentTranche + 1;
    }

    /**
     * @notice Creates new token pool for open sale
     * @param supply_ Amount of tokens to be put on sale
     * @param price_ Price per token
     */
    function addTranche(uint256 supply_, uint256 price_) external onlyOwner {
        require(supply_ > 0, "Invalid token amount for sale");

        uint256 nextTranche = currentTranche + 1;
        address[] memory accounts;
        uint256[] memory caps;
        _setupTranche(nextTranche, Tranche(price_, supply_.toUint64(), 0, 0, 0), accounts, caps);
        currentTranche = nextTranche;

        emit TrancheAdded(nextTranche, supply_, price_);
    }

    /**
     * @notice Creates whitelisted token pool
     * @param supply_ Amount of tokens to be put on sale
     * @param price_ Price per token
     * @param accounts Accounts to be included in whitelist
     */
    function addWhitelistedTranche(
        uint256 supply_,
        uint256 price_,
        address[] memory accounts,
        uint256[] memory caps
    ) external onlyOwner {
        require(supply_ > 0, "Invalid token amount for sale");

        uint256 nextTranche = currentTranche + 1;
        _setupTranche(nextTranche, Tranche(price_, supply_.toUint64(), 0, 0, 0), accounts, caps);
        currentTranche = nextTranche;

        emit TrancheAdded(nextTranche, supply_, price_);
    }

    /**
     * @notice Adds accounts to whitelist
     * @dev Operation is idempotent - if account is already on whitelist than nothing happens
     * @param accounts Accounts to be added to whitelist
     */
    function addToWhitelist(address[] memory accounts, uint256[] memory caps) external onlyOwner {
        _addToWhitelist(currentTranche, accounts, caps);
    }

    /**
     * @notice Removes accounts from whitelist
     * @dev Operation is idempotent - if account is not on whitelist than nothing happens
     * @param accounts Accounts to be removed from whitelist
     */
    function removeFromWhitelist(address[] calldata accounts) external onlyOwner {
        _removeFromWhitelist(accounts);
    }

    /**
     * @notice Returns current tranche details excluding whitelist info
     * @return Tranche details
     */
    function getTrancheDetails() external view returns (Tranche memory) {
        return tranches[currentTranche];
    }

    /**
     * @notice Returns whether account is whitelisted in current tranche
     * @return Whether account is whitelisted
     */
    function isAccountWhitelisted(address account) external view returns (bool) {
        return _isAccountWhitelisted(currentTranche, account);
    }

    /**
     * @notice Returns tokens supply intended for sale (available + sold) in current tranche
     * @return Tokens supply intended for sale
     */
    function supply() external view returns (uint256) {
        return tranches[currentTranche].publicSupply + tranches[currentTranche].whitelistedSupply;
    }

    /**
     * @notice Returns tokens in current tranche
     * @return Tokens sold in current tranche
     */
    function sold() external view returns (uint256) {
        return tranches[currentTranche].publicSold + tranches[currentTranche].whitelistedSold;
    }

    /**
     * @notice Returns number of tokens available for account
     * @return Number of available tokens
     */
    function available(address account) public view returns (uint256) {
        return _getAvailablePublicTokens() + _getAvailableWhitelistedTokensForAccount(account);
    }

    function _setupTranche(
        uint256 trancheIndex,
        Tranche memory tranche_,
        address[] memory accounts,
        uint256[] memory caps
    ) private {
        tranches[trancheIndex] = tranche_;
        _addToWhitelist(trancheIndex, accounts, caps);
    }

    function _validateWhitelist(uint256 trancheIndex, address[] memory accounts, uint256[] memory caps) private view {
        require(accounts.length == caps.length, "Accounts and caps length mismatch");

        uint256 maxCap = tranches[trancheIndex].publicSupply;
        uint256 capFromNewAccounts = 0;
        for (uint256 i = 0; i < accounts.length; i++) {
            require(!_isAccountWhitelisted(trancheIndex, accounts[i]), "Account already whitelisted");
            capFromNewAccounts += caps[i];
        }
        require(capFromNewAccounts <= maxCap, "Whitelist supply exceeds total supply");
    }

    function _addToWhitelist(uint256 trancheIndex, address[] memory accounts, uint256[] memory caps) private {
        _validateWhitelist(trancheIndex, accounts, caps);

        Tranche storage tranche = tranches[trancheIndex];
        uint256 capFromNewAccounts = 0;
        for (uint256 i = 0; i < accounts.length; i++) {
            _whitelists[trancheIndex][accounts[i]] = Whitelist(caps[i].toUint128(), 0);
            capFromNewAccounts += caps[i];
        }
        tranche.publicSupply -= capFromNewAccounts.toUint64();
        tranche.whitelistedSupply += capFromNewAccounts.toUint64();
    }

    function _removeFromWhitelist(address[] calldata accounts) private {
        uint256 accountsRemainingContribution = 0;
        for (uint256 i = 0; i < accounts.length; i++) {
            Whitelist memory whitelist = _whitelists[currentTranche][accounts[i]];
            accountsRemainingContribution += (whitelist.cap - whitelist.contribution);
            _whitelists[currentTranche][accounts[i]] = Whitelist(0, 0);
        }
        tranches[currentTranche].publicSupply += accountsRemainingContribution.toUint64();
        tranches[currentTranche].whitelistedSupply -= accountsRemainingContribution.toUint64();
    }

    function _isAccountWhitelisted(uint256 trancheIndex, address account) private view returns (bool) {
        return _whitelists[trancheIndex][account].cap > 0;
    }

    function _getAvailablePublicTokens() private view returns (uint256) {
        return tranches[currentTranche].publicSupply - tranches[currentTranche].publicSold;
    }

    function _getAvailableWhitelistedTokensForAccount(address account) private view returns (uint256) {
        if (_isAccountWhitelisted(currentTranche, account) == false) {
            return 0;
        }
        Whitelist memory whitelist = _whitelists[currentTranche][account];
        return whitelist.cap - whitelist.contribution;
    }

    function _purchaseWhitelistedTokens(uint256 trancheIndex, address beneficiary, uint256 amount) private {
        tranches[trancheIndex].whitelistedSold += amount.toUint64();
        _whitelists[trancheIndex][beneficiary].contribution += amount.toUint128();
    }

    function _purchasePublicTokens(uint256 trancheIndex, uint256 amount) private {
        tranches[trancheIndex].publicSold += amount.toUint64();
    }

    /**
     * @dev Executed when a purchase has been validated and is ready to be executed
     * @param beneficiary Address receiving the tokens
     * @param tokenAmount Number of tokens to be purchased
     */
    function _processPurchase(address beneficiary, uint256 tokenAmount) internal virtual {
        uint256 trancheIndex = currentTranche;
        uint256 value = tokenAmount * tranches[trancheIndex].price;

        uint256 availableFromWhitelist = _getAvailableWhitelistedTokensForAccount(beneficiary);
        if (availableFromWhitelist > 0) {
            uint256 amount = MathUpgradeable.min(tokenAmount, availableFromWhitelist);

            _purchaseWhitelistedTokens(trancheIndex, beneficiary, amount);
            tokenAmount -= amount;
        }
        _purchasePublicTokens(trancheIndex, tokenAmount);

        emit TokensPurchased(beneficiary, value, tokenAmount);

        currency.safeTransferFrom(beneficiary, wallet, value);
        _deliverTokens(beneficiary, tokenAmount);
    }

    function _deliverTokens(address beneficiary, uint256 tokenAmount) internal virtual {
        IERC721Mintable(token).mint(beneficiary, tokenAmount, tokenUri);
    }

    uint256[43] private __gap;
}
