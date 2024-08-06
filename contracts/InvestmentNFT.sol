// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC721Upgradeable, ERC721Upgradeable, ERC721EnumerableUpgradeable, IERC165Upgradeable, IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {ERC721PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import {ERC721URIStorageUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {CheckpointsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CheckpointsUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {IInvestmentNFT} from "./interfaces/IInvestmentNFT.sol";
import {IMarketplace} from "./interfaces/IMarketplace.sol";
import {_add, _subtract} from "./libraries/Utils.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

error InvestmentNft__AlreadyMinter();
error InvestmentNft__NotMinter();
error InvestmentNft__InvalidTokenValue();
error InvestmentNft__NotTokenOwner();
error InvestmentNft__SplitLimitExceeded();
error InvestmentNft__TokenValuesBeforeAfterSplitMismatch();
error InvestmentNft__InvestmentTooLow();
error InvestmentNft__TokenNotExists(uint256 _tokenId);
error InvestmentNft__TokenListed();
error InvestmentNft__InvalidMarketplaceAddress();
error InvestmentNft__NotCalledByMarketplace();

/**
 * @title Investment NFT contract
 */
contract InvestmentNFT is
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC721PausableUpgradeable,
    ERC2981Upgradeable,
    OwnablePausable,
    IInvestmentNFT
{
    using CheckpointsUpgradeable for CheckpointsUpgradeable.History;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    uint256 private constant SPLIT_LIMIT = 10;
    uint256 private constant DECIMALS = 1000000;
    uint256 private constant INTEGERS = 10000;

    /**
     * @notice Minimum investment value
     */
    uint256 public minimumValue;

    /**
     * @notice Investment value assigned to token
     */
    mapping(uint256 => uint256) public tokenValue;

    CountersUpgradeable.Counter private _tokenIdCounter;
    mapping(address => bool) private _minters;

    EnumerableSetUpgradeable.AddressSet private _investors;
    mapping(address => CheckpointsUpgradeable.History) private _accountValueHistory;
    CheckpointsUpgradeable.History private _totalValueHistory;

    Metadata public metadata;
    IMarketplace private s_marketplace;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param name Investment NFT name
     * @param symbol Investment NFT symbol
     * @param owner Contract owner
     * @param royaltyAccount Address where to send royalty
     * @param royaltyValue Royalty value in basis points
     * @param _minimumValue Minimum investment value
     * @param _metadata Metadata structure
     */
    function initialize(
        string memory name,
        string memory symbol,
        address owner,
        address royaltyAccount,
        uint96 royaltyValue,
        uint256 _minimumValue,
        Metadata memory _metadata
    ) public initializer {
        __Context_init();
        __ERC165_init();
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ERC721Pausable_init();
        __OwnablePausable_init(owner);
        _setDefaultRoyalty(royaltyAccount, royaltyValue);

        _minters[owner] = true;
        minimumValue = _minimumValue;
        metadata = Metadata({
            name: _metadata.name,
            description: _metadata.description,
            image: _metadata.image,
            externalUrl: _metadata.externalUrl
        });
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
    function mint(address to, uint256 value) external whenNotPaused {
        if (!_minters[_msgSender()]) revert InvestmentNft__NotMinter();
        if (value < minimumValue) revert InvestmentNft__InvestmentTooLow();
        _mintWithURI(to, value);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function split(uint256 tokenId, uint256[] calldata values) external whenNotPaused {
        if (s_marketplace.getListingByTokenId(address(this), tokenId).listed) revert InvestmentNft__TokenListed();
        _validateSplit(tokenId, values);

        _burn(tokenId);
        _resetTokenRoyalty(tokenId);

        address owner = _msgSender();
        for (uint256 i; i < values.length; ) {
            _mintWithURI(owner, values[i]);
            unchecked {
                i++;
            }
        }

        emit TokenSplitted(_msgSender(), tokenId);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */ function setMetadataName(string memory _name) external override onlyOwner {
        metadata.name = _name;

        emit MetadataNameChanged(_name);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */ function setMetadataDescription(string memory _description) external override onlyOwner {
        metadata.description = _description;

        emit MetadataDescriptionChanged(_description);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */ function setMetadataImage(string memory _image) external override onlyOwner {
        metadata.image = _image;

        emit MetadataImageChanged(_image);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */ function setMetadataExternalUrl(string memory _extenralUrl) external override onlyOwner {
        metadata.externalUrl = _extenralUrl;

        emit MetadataExternalUrlChanged(_extenralUrl);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */ function setMinimumValue(uint256 _minimumValue) external override onlyOwner {
        minimumValue = _minimumValue;

        emit MinimumValueChanged(_minimumValue);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */ function setAllMetadata(Metadata memory _metadata) external override onlyOwner {
        metadata.name = _metadata.name;
        metadata.description = _metadata.description;
        metadata.image = _metadata.image;
        metadata.externalUrl = _metadata.externalUrl;

        emit MetadataChanged(_metadata.name, _metadata.description, _metadata.image, _metadata.externalUrl);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function setMarketplaceAddress(address _address) external onlyOwner {
        if (_address == address(0)) revert InvestmentNft__InvalidMarketplaceAddress();
        s_marketplace = IMarketplace(_address);

        emit MarketplaceAddressChanged(_address);
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
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        metadata.name,
                        '",',
                        '"description": "',
                        metadata.description,
                        '",',
                        '"image": "',
                        metadata.image,
                        '",',
                        '"external_url": "',
                        metadata.externalUrl,
                        '",',
                        '"attributes": [{"trait_type":"value","value":"',
                        getSharePercentage(tokenId),
                        '"}]',
                        "}"
                    )
                )
            )
        );

        // Create token URI
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getSharePercentage(uint256 _tokenId) public view override returns (string memory) {
        if (!_exists(_tokenId)) revert InvestmentNft__TokenNotExists(_tokenId);

        uint256 nominator = tokenValue[_tokenId];
        uint256 denominator = getTotalInvestmentValue();

        // Calculate percentage
        uint256 percentage = (nominator * DECIMALS) / denominator; // Multiply by 1000000 to get six decimals

        // Convert percentage to string
        string memory percentageString = toString(percentage / INTEGERS); // Divide by 10000 to get back to four decimals

        // Get the digits after the decimal point
        uint256 digits = percentage % INTEGERS;

        // Pad with zeros if necessary
        string memory decimalDigits = digits < 10
            ? string(abi.encodePacked("000", toString(digits)))
            : (
                digits < 100 ? string(abi.encodePacked("00", toString(digits))) : digits < 1000
                    ? string(abi.encodePacked("0", toString(digits)))
                    : toString(digits)
            );

        // Append the decimal point and four digits after it
        percentageString = string(abi.encodePacked(percentageString, ".", decimalDigits, "%"));

        return percentageString;
    }

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(IERC165Upgradeable, ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IInvestmentNFT).interfaceId ||
            ERC2981Upgradeable.supportsInterface(interfaceId) ||
            super.supportsInterface(interfaceId);
    }

    function _mintWithURI(address to, uint256 value) private {
        if (value <= 0) revert InvestmentNft__InvalidTokenValue();

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        tokenValue[tokenId] = value;
        _safeMint(to, tokenId);
    }

    function _burn(uint256 tokenId) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
        tokenValue[tokenId] = 0;
        _resetTokenRoyalty(tokenId);
    }

    function _validateSplit(uint256 tokenId, uint256[] calldata values) private view {
        if (_msgSender() != ownerOf(tokenId)) revert InvestmentNft__NotTokenOwner();
        if (values.length > SPLIT_LIMIT) revert InvestmentNft__SplitLimitExceeded();
        uint256 valuesSum = 0;
        uint256 minimumNftValue = minimumValue;
        for (uint256 i; i < values.length; ) {
            if (values[i] < minimumNftValue) revert InvestmentNft__InvestmentTooLow();
            valuesSum += values[i];
            unchecked {
                i++;
            }
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
        if (s_marketplace.getListingByTokenId(address(this), tokenId).listed)
            s_marketplace.cancelListing(address(this), tokenId);
    }

    function _addAccountValue(address account, uint256 value) internal virtual {
        _accountValueHistory[account].push(_add, value);
        _investors.add(account);
    }

    function approve(address to, uint256 tokenId) public virtual override(ERC721Upgradeable, IERC721Upgradeable) {
        super.approve(to, tokenId);
        if (s_marketplace.getListingByTokenId(address(this), tokenId).listed && to == address(0)) {
            s_marketplace.cancelListing(address(this), tokenId);
        }
    }

    function setApprovalForAll(
        address operator,
        bool approved
    ) public virtual override(ERC721Upgradeable, IERC721Upgradeable) {
        super.setApprovalForAll(operator, approved);
        uint256 balance = balanceOf(_msgSender());
        for (uint256 i; i < balance; ) {
            uint256 tokenId = tokenOfOwnerByIndex(_msgSender(), i);
            if (s_marketplace.getListingByTokenId(address(this), tokenId).listed) {
                s_marketplace.cancelListing(address(this), tokenId);
            }
            unchecked {
                i++;
            }
        }
    }

    function _subtractAccountValue(address account, uint256 value) internal virtual {
        _accountValueHistory[account].push(_subtract, value);
        if (balanceOf(account) == 0) {
            _investors.remove(account);
        }
    }

    // Function to convert uint to string
    function toString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    uint256[39] private __gap;
}
