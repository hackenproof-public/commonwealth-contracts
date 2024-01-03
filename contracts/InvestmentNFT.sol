// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ERC721Upgradeable, ERC721EnumerableUpgradeable, IERC165Upgradeable, IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {ERC721PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import {ERC721URIStorageUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {CheckpointsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CheckpointsUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {IInvestmentNFT} from "./interfaces/IInvestmentNFT.sol";
import {_add, _subtract} from "./libraries/Utils.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

error InvestmentNft__AlreadyMinter();
error InvestmentNft__NotMinter();
error InvestmentNft__InvalidTokenValue();
error InvestmentNft__NotTokenOwner();
error InvestmentNft__SplitLimitExceeded();
error InvestmentNft__TokenUrisAndValuesLengthsMismatch();
error InvestmentNft__TokenValuesBeforeAfterSplitMismatch();

/**
 * @title Investment NFT contract
 */
contract InvestmentNFT is
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC721PausableUpgradeable,
    OwnablePausable,
    IInvestmentNFT
{
    using CheckpointsUpgradeable for CheckpointsUpgradeable.History;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    uint256 private constant SPLIT_LIMIT = 10;

    /**
     * @notice Investment value assigned to token
     */
    mapping(uint256 => uint256) public tokenValue;

    CountersUpgradeable.Counter private _tokenIdCounter;
    mapping(address => bool) private _minters;

    EnumerableSetUpgradeable.AddressSet private _investors;
    mapping(address => CheckpointsUpgradeable.History) private _accountValueHistory;
    CheckpointsUpgradeable.History private _totalValueHistory;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param name Investment NFT name
     * @param symbol Investment NFT symbol
     * @param owner Contract owner
     */
    function initialize(string memory name, string memory symbol, address owner) public initializer {
        __Context_init();
        __ERC165_init();
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ERC721Pausable_init();
        __OwnablePausable_init(owner);

        _minters[owner] = true;
    }

    /**
     * @notice Sets NFT metadata URI
     * @param tokenId Token ID
     * @param tokenUri New metadata URI
     */
    function setTokenUri(uint256 tokenId, string memory tokenUri) external onlyOwner {
        _setTokenURI(tokenId, tokenUri);
        emit TokenURIChanged(_msgSender(), tokenId, tokenUri);
    }

    /**
     * @notice Adds account to minter list
     * @param account Address to be added
     */
    function addMinter(address account) external onlyOwner {
        if (_minters[account]) revert InvestmentNft__AlreadyMinter();

        _minters[account] = true;
        emit MinterAdded(_msgSender(), account);
    }

    /**
     * @notice Removes account from minter list
     * @param account Address to be removed
     */
    function removeMinter(address account) external onlyOwner {
        if (!_minters[account]) revert InvestmentNft__NotMinter();

        _minters[account] = false;
        emit MinterRemoved(_msgSender(), account);
    }

    /**
     * @notice Returns if account has minter rights
     * @param account Address to check rights for
     */
    function isMinter(address account) external view returns (bool) {
        return _minters[account];
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function mint(address to, uint256 value, string calldata tokenUri) external whenNotPaused {
        if (!_minters[_msgSender()]) revert InvestmentNft__NotMinter();
        _mintWithURI(to, value, tokenUri);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function split(uint256 tokenId, uint256[] calldata values, string[] calldata tokenUris) external whenNotPaused {
        _validateSplit(tokenId, values, tokenUris);

        _burn(tokenId);
        address owner = _msgSender();
        for (uint256 i = 0; i < values.length; i++) {
            _mintWithURI(owner, values[i], tokenUris[i]);
        }

        emit TokenSplitted(_msgSender(), tokenId);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getInvestmentValue(address account) public view virtual returns (uint256) {
        return _accountValueHistory[account].latest();
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getPastInvestmentValue(address account, uint256 blockNumber) public view virtual returns (uint256) {
        return _accountValueHistory[account].getAtProbablyRecentBlock(blockNumber);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getTotalInvestmentValue() public view virtual returns (uint256) {
        return _totalValueHistory.latest();
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getPastTotalInvestmentValue(uint256 blockNumber) public view virtual returns (uint256) {
        return _totalValueHistory.getAtProbablyRecentBlock(blockNumber);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getParticipation(address account) external view returns (uint256, uint256) {
        return (getInvestmentValue(account), getTotalInvestmentValue());
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getPastParticipation(address account, uint256 blockNumber) external view returns (uint256, uint256) {
        return (getPastInvestmentValue(account, blockNumber), getPastTotalInvestmentValue(blockNumber));
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getInvestors() external view returns (address[] memory) {
        return _investors.values();
    }

    /**
     * @inheritdoc IERC721MetadataUpgradeable
     */
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165Upgradeable, ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (bool) {
        return interfaceId == type(IInvestmentNFT).interfaceId || super.supportsInterface(interfaceId);
    }

    function _mintWithURI(address to, uint256 value, string calldata tokenUri) private {
        if (value <= 0) revert InvestmentNft__InvalidTokenValue();

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        tokenValue[tokenId] = value;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function _burn(uint256 tokenId) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
        tokenValue[tokenId] = 0;
    }

    function _validateSplit(uint256 tokenId, uint256[] calldata values, string[] calldata tokenUris) private view {
        if (_msgSender() != ownerOf(tokenId)) revert InvestmentNft__NotTokenOwner();
        if (values.length > SPLIT_LIMIT) revert InvestmentNft__SplitLimitExceeded();
        if (values.length != tokenUris.length) revert InvestmentNft__TokenUrisAndValuesLengthsMismatch();
        uint256 valuesSum = 0;
        for (uint256 i = 0; i < values.length; i++) {
            valuesSum += values[i];
        }
        if (valuesSum != tokenValue[tokenId]) revert InvestmentNft__TokenValuesBeforeAfterSplitMismatch();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721PausableUpgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        super._afterTokenTransfer(from, to, firstTokenId, batchSize);

        if (from != to) {
            if (from == address(0)) {
                _onTokenMinted(to, firstTokenId);
            } else if (to == address(0)) {
                _onTokenBurned(from, firstTokenId);
            } else {
                _onTokenTransferred(from, to, firstTokenId);
            }
        }
    }

    function _onTokenMinted(address to, uint256 tokenId) internal virtual {
        uint256 value = tokenValue[tokenId];
        _totalValueHistory.push(_add, value);
        _addAccountValue(to, value);
    }

    function _onTokenBurned(address from, uint256 tokenId) internal virtual {
        uint256 value = tokenValue[tokenId];
        _totalValueHistory.push(_subtract, value);
        _subtractAccountValue(from, value);
    }

    function _onTokenTransferred(address from, address to, uint256 tokenId) internal virtual {
        uint256 value = tokenValue[tokenId];
        _subtractAccountValue(from, value);
        _addAccountValue(to, value);
    }

    function _addAccountValue(address account, uint256 value) internal virtual {
        _accountValueHistory[account].push(_add, value);
        _investors.add(account);
    }

    function _subtractAccountValue(address account, uint256 value) internal virtual {
        _accountValueHistory[account].push(_subtract, value);
        if (balanceOf(account) == 0) {
            _investors.remove(account);
        }
    }

    uint256[44] private __gap;
}
