// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721, ERC721Enumerable, IERC165, IERC721Enumerable, IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721Pausable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/Checkpoints.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IInvestmentNFT} from "./interfaces/IInvestmentNFT.sol";
import {_add, _subtract} from "./libraries/Utils.sol";

/**
 * @title Investment NFT contract
 */
contract InvestmentNFT is ERC721Enumerable, ERC721URIStorage, ERC721Pausable, Ownable, IInvestmentNFT {
    using Checkpoints for Checkpoints.History;
    using Counters for Counters.Counter;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @notice Investment value assigned to token
     */
    mapping(uint256 => uint256) public tokenValue;

    Counters.Counter private _tokenIdCounter;
    mapping(address => bool) private _minters;

    EnumerableSet.AddressSet private _investors;
    mapping(address => Checkpoints.History) private _accountValueHistory;
    Checkpoints.History private _totalValueHistory;

    modifier onlyMinter() {
        require(_minters[msg.sender], "Account does not have minter rights");
        _;
    }

    /**
     * @notice Initializes the contract
     */
    constructor(string memory name, string memory symbol, address owner) ERC721(name, symbol) {
        require(owner != address(0), "Owner is zero address");

        _transferOwnership(owner);
        _minters[owner] = true;
    }

    /**
     * @notice Sets NFT metadata URI
     * @param tokenId Token ID
     * @param tokenUri New metadata URI
     */
    function setTokenUri(uint256 tokenId, string memory tokenUri) external onlyOwner {
        _setTokenURI(tokenId, tokenUri);
        emit TokenURIChanged(msg.sender, tokenId, tokenUri);
    }

    /**
     * @notice Adds account to minter list
     * @param account Address to be added
     */
    function addMinter(address account) external onlyOwner {
        require(!_minters[account], "Account already has minter rights");

        _minters[account] = true;
        emit MinterAdded(msg.sender, account);
    }

    /**
     * @notice Removes account from minter list
     * @param account Address to be removed
     */
    function removeMinter(address account) external onlyOwner {
        require(_minters[account], "Account does not have minter rights");

        _minters[account] = false;
        emit MinterRemoved(msg.sender, account);
    }

    /**
     * @notice Returns if account has minter rights
     * @param account Address to check rights for
     */
    function isMinter(address account) external view returns (bool) {
        return _minters[account];
    }

    /**
     * @notice Disables operations on contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Enables operations on contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function mint(address to, uint256 value, string calldata tokenUri) external onlyMinter whenNotPaused {
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

        emit TokenSplitted(msg.sender, tokenId);
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
     * @inheritdoc IERC721Metadata
     */
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165, ERC721, ERC721Enumerable) returns (bool) {
        return interfaceId == type(IInvestmentNFT).interfaceId || super.supportsInterface(interfaceId);
    }

    function _mintWithURI(address to, uint256 value, string calldata tokenUri) private {
        require(value > 0, "Invalid token value");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        tokenValue[tokenId] = value;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        tokenValue[tokenId] = 0;
    }

    function _validateSplit(uint256 tokenId, uint256[] calldata values, string[] calldata tokenUris) private view {
        require(_msgSender() == ownerOf(tokenId), "Caller is not a token owner");
        require(values.length == tokenUris.length, "Values and tokens URIs length mismatch");
        uint256 valuesSum = 0;
        for (uint256 i = 0; i < values.length; i++) {
            valuesSum += values[i];
        }
        require(valuesSum == tokenValue[tokenId], "Tokens value before and after split do not match");
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable, ERC721Pausable) whenNotPaused {
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
}
