// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {PerpetualNFT} from "./PerpetualNFT.sol";
import {IERC721Upgradeable, ERC721Upgradeable, ERC721EnumerableUpgradeable, IERC165Upgradeable, IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {ERC721PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import {ERC721URIStorageUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {CheckpointsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CheckpointsUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {IMarketplace} from "./interfaces/IMarketplace.sol";
import {IPerpetualNFT} from "./interfaces/IPerpetualNFT.sol";
import {_add, _subtract} from "./libraries/Utils.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {SPLIT_LIMIT} from "./libraries/Constants.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

error PerpetualNFT__MinterAlreadyRegistered(address wallet);
error PerpetualNFT__ValueToLow();
error PerpetualNFT__MinterNotRegistered();
error PerpetualNFT__TokenNotExists(uint256 tokenId);
error PerpetualNFT__InvalidTokenValue();
error PerpetualNFT__OperationNotAllowed();
error PerpetualNFT__SplittingDisabled();
error PerpetualNFT__NotTokenOwner(address wallet, uint256 tokenId);
error PerpetualNFT__SplitLimitExceeded();
error PerpetualNFT__TokenValuesBeforeAfterSplitMismatch();
error PerpetualNFT__NewPrincipalExceedsPrevious(uint256 tokenId);
error PerpetualNFT__ZeroAddress();
error PerpetualNFT_PerpetualFundAlreadySet();
error PerpetualFund__TokenListedOnSale();

/**
 * @title Perpetual NFT contract
 */
contract PerpetualNFT is
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC721PausableUpgradeable,
    ERC2981Upgradeable,
    OwnablePausable,
    IPerpetualNFT
{
    using CheckpointsUpgradeable for CheckpointsUpgradeable.History;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    uint256 private constant DECIMALS = 1000000;
    uint256 private constant INTEGERS = 10000;

    /**
     * @notice Split enabled/disabled flag
     */
    bool private s_splittingEnabled;

    /**
     * @notice Address of profit distributor
     */
    address private s_profitDistributor;

    /**
     * @notice Address of perpetual fund
     */
    address private s_perpetualFund;

    /**
     * @notice Address of marketplace contract
     */
    IMarketplace private s_marketplace;

    /**
     * @notice Token ID counter
     */
    CountersUpgradeable.Counter internal s_tokenIdCounter;

    /**
     * @notice Minimum investment value
     */
    uint256 private s_minimumValue;

    /**
     * @notice Metadata structure
     */
    Metadata private s_metadata;

    /**
     * @notice Investors list
     */
    EnumerableSetUpgradeable.AddressSet private s_investors;

    /**
     * @notice Total investment value history
     */
    CheckpointsUpgradeable.History private s_totalValueHistory;

    /**
     * @notice Minter list
     */
    mapping(address => bool) private s_minters;

    /**
     * @notice Account investment value history
     */
    mapping(address => CheckpointsUpgradeable.History) private s_accountValueHistory;

    /**
     * @notice Investment value assigned to token
     */
    mapping(uint256 => uint256) private s_tokenValue;

    /**
     * @notice Current principal value assigned to token
     */
    mapping(uint256 => uint256) private s_currentPrincipal;

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
     * @param _profitDistributor Address of profit distributor
     * @param _metadata Metadata structure
     * @param _marketplace Marketplace contract
     */
    function initialize(
        string memory name,
        string memory symbol,
        address owner,
        address royaltyAccount,
        uint96 royaltyValue,
        uint256 _minimumValue,
        address _profitDistributor,
        Metadata memory _metadata,
        IMarketplace _marketplace
    ) public initializer {
        __Context_init();
        __ERC165_init();
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ERC721Pausable_init();
        __OwnablePausable_init(owner);
        _setDefaultRoyalty(royaltyAccount, royaltyValue);

        s_minters[owner] = true;
        s_minimumValue = _minimumValue;
        s_splittingEnabled = true;
        s_profitDistributor = _profitDistributor;
        s_metadata = Metadata({
            name: _metadata.name,
            description: _metadata.description,
            image: _metadata.image,
            externalUrl: _metadata.externalUrl
        });
        s_marketplace = _marketplace;
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function addMinter(address _account) external override onlyOwner {
        if (s_minters[_account]) revert PerpetualNFT__MinterAlreadyRegistered(_account);

        s_minters[_account] = true;
        emit MinterAdded(_account);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function removeMinter(address _account) external override onlyOwner {
        if (!s_minters[_account]) revert PerpetualNFT__MinterNotRegistered();

        s_minters[_account] = false;
        emit MinterRemoved(_account);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function mint(address _to, uint256 _value) external override whenNotPaused {
        if (!s_minters[_msgSender()]) revert PerpetualNFT__MinterNotRegistered();
        if (_value < s_minimumValue) revert PerpetualNFT__ValueToLow();
        _mintWithURI(_to, _value);
        s_currentPrincipal[s_tokenIdCounter.current() - 1] = _value;
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function split(uint256 _tokenId, uint256[] calldata _values) external override whenNotPaused {
        if (!s_splittingEnabled) {
            revert PerpetualNFT__SplittingDisabled();
        }

        _validateSplit(_tokenId, _values);

        uint256 totalValue = s_tokenValue[_tokenId];
        uint256 oldPrincipal = s_currentPrincipal[_tokenId];

        address owner = _msgSender();

        for (uint256 i; i < _values.length; ) {
            _mintWithURI(owner, _values[i]);

            uint256 newPrincipal = (((_values[i] * 1e18) / totalValue) * oldPrincipal) / 1e18;
            s_currentPrincipal[s_tokenIdCounter.current() - 1] = newPrincipal;
            unchecked {
                i++;
            }
        }

        _burn(_tokenId);
        _resetTokenRoyalty(_tokenId);

        emit TokenSplitted(_msgSender(), _tokenId);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function enableSplitting(bool _enabled) external override {
        if (_msgSender() != s_perpetualFund && _msgSender() != s_profitDistributor) {
            revert PerpetualNFT__OperationNotAllowed();
        }
        s_splittingEnabled = _enabled;
        emit SplittingEnabled(_enabled);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function updatePrincipals(Principal[] memory _principals) external override {
        if (_msgSender() != s_profitDistributor) {
            revert PerpetualNFT__OperationNotAllowed();
        }
        for (uint256 i; i < _principals.length; ) {
            if (s_currentPrincipal[_principals[i].tokenId] < _principals[i].value) {
                revert PerpetualNFT__NewPrincipalExceedsPrevious(_principals[i].tokenId);
            }
            s_currentPrincipal[_principals[i].tokenId] = _principals[i].value;
            emit PrincipalUpdated(_principals[i].tokenId, _principals[i].value);
            unchecked {
                i++;
            }
        }
    }

    function setPerpetualFund(address _perpetualFund) external override onlyOwner {
        if (_perpetualFund == address(0)) {
            revert PerpetualNFT__ZeroAddress();
        }
        if (s_perpetualFund != address(0)) {
            revert PerpetualNFT_PerpetualFundAlreadySet();
        }

        s_perpetualFund = _perpetualFund;
        emit PerpetualFundSet(_perpetualFund);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */ function setMetadataName(string memory _name) external override onlyOwner {
        s_metadata.name = _name;

        emit MetadataNameChanged(_name);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */ function setMetadataDescription(string memory _description) external override onlyOwner {
        s_metadata.description = _description;

        emit MetadataDescriptionChanged(_description);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */ function setMetadataImage(string memory _image) external override onlyOwner {
        s_metadata.image = _image;

        emit MetadataImageChanged(_image);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */ function setAllMetadata(Metadata memory _metadata) external override onlyOwner {
        s_metadata.name = _metadata.name;
        s_metadata.description = _metadata.description;
        s_metadata.image = _metadata.image;
        s_metadata.externalUrl = _metadata.externalUrl;

        emit MetadataChanged(_metadata.name, _metadata.description, _metadata.image, _metadata.externalUrl);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */ function setMetadataExternalUrl(string memory _extenralUrl) external override onlyOwner {
        s_metadata.externalUrl = _extenralUrl;

        emit MetadataExternalUrlChanged(_extenralUrl);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function setMinimumValue(uint256 _minimumValue) external override onlyOwner {
        s_minimumValue = _minimumValue;

        emit MinimumValueChanged(_minimumValue);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function setMarketplace(address _marketplace) external onlyOwner {
        if (_marketplace == address(0)) revert PerpetualNFT__ZeroAddress();
        s_marketplace = IMarketplace(_marketplace);

        emit MarketplaceSet(_marketplace);
    }

    /**
     * @inheritdoc ERC721Upgradeable
     */
    function approve(address to, uint256 tokenId) public virtual override(ERC721Upgradeable, IERC721Upgradeable) {
        super.approve(to, tokenId);
        if (to != address(s_marketplace) && s_marketplace.getListingByTokenId(address(this), tokenId).listed) {
            s_marketplace.cancelListing(address(this), tokenId);
        }
    }

    /**
     * @inheritdoc ERC721Upgradeable
     */
    function setApprovalForAll(
        address operator,
        bool approved
    ) public virtual override(ERC721Upgradeable, IERC721Upgradeable) {
        super.setApprovalForAll(operator, approved);
        if (operator == address(s_marketplace) && !approved) {
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
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function marketplace() external view override returns (address) {
        return address(s_marketplace);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function isMinter(address _account) external view override returns (bool) {
        return s_minters[_account];
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function getParticipation(address _account) external view override returns (uint256, uint256) {
        return (getInvestmentValue(_account), getTotalInvestmentValue());
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function getPastParticipation(
        address _account,
        uint256 _blockNumber
    ) external view override returns (uint256, uint256) {
        return (getPastInvestmentValue(_account, _blockNumber), getPastTotalInvestmentValue(_blockNumber));
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function getInvestors() external view override returns (address[] memory) {
        return s_investors.values();
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function tokenValue(uint256 tokenId) external view override returns (uint256) {
        return s_tokenValue[tokenId];
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function splittingEnabled() external view override returns (bool) {
        return s_splittingEnabled;
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function profitDistributor() external view override returns (address) {
        return s_profitDistributor;
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function minimumValue() external view override returns (uint256) {
        return s_minimumValue;
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function metadata() external view override returns (Metadata memory) {
        return s_metadata;
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function perpetualFund() external view override returns (address) {
        return s_perpetualFund;
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function currentPrincipal(uint256 tokenId) external view override returns (uint256) {
        return s_currentPrincipal[tokenId];
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function getCurrentTokenValueDetails(uint256 _tokenId) external view override returns (uint256, uint256) {
        return (s_tokenValue[_tokenId], s_currentPrincipal[_tokenId]);
    }

    /**
     * @inheritdoc IERC721MetadataUpgradeable
     */
    function tokenURI(
        uint256 _tokenId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        s_metadata.name,
                        '",',
                        '"description": "',
                        s_metadata.description,
                        '",',
                        '"image": "',
                        s_metadata.image,
                        '",',
                        '"external_url": "',
                        s_metadata.externalUrl,
                        '",',
                        '"attributes": [{"trait_type":"value","value":"',
                        getSharePercentage(_tokenId),
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
     * @inheritdoc IPerpetualNFT
     */
    function getSharePercentage(uint256 _tokenId) public view override returns (string memory) {
        if (!_exists(_tokenId)) revert PerpetualNFT__TokenNotExists(_tokenId);

        uint256 nominator = s_tokenValue[_tokenId];
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
     * @inheritdoc IPerpetualNFT
     */
    function getInvestmentValue(address _account) public view override returns (uint256) {
        return s_accountValueHistory[_account].latest();
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function getPastInvestmentValue(address _account, uint256 _blockNumber) public view override returns (uint256) {
        return s_accountValueHistory[_account].getAtProbablyRecentBlock(_blockNumber);
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function getTotalInvestmentValue() public view override returns (uint256) {
        return s_totalValueHistory.latest();
    }

    /**
     * @inheritdoc IPerpetualNFT
     */
    function getPastTotalInvestmentValue(uint256 _blockNumber) public view override returns (uint256) {
        return s_totalValueHistory.getAtProbablyRecentBlock(_blockNumber);
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
            interfaceId == type(IPerpetualNFT).interfaceId ||
            ERC2981Upgradeable.supportsInterface(interfaceId) ||
            super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
        s_tokenValue[tokenId] = 0;
        _resetTokenRoyalty(tokenId);
        s_currentPrincipal[tokenId] = 0;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721PausableUpgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        if (s_marketplace.getListingByTokenId(address(this), tokenId).listed) {
            s_marketplace.cancelListing(address(this), tokenId);
        }
    }

    function _afterTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override {
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

    function _onTokenMinted(address _to, uint256 _tokenId) internal {
        uint256 value = s_tokenValue[_tokenId];
        s_totalValueHistory.push(_add, value);
        _addAccountValue(_to, value);
    }

    function _onTokenBurned(address _from, uint256 _tokenId) private {
        uint256 value = s_tokenValue[_tokenId];
        s_totalValueHistory.push(_subtract, value);
        _subtractAccountValue(_from, value);
    }

    function _onTokenTransferred(address _from, address _to, uint256 _tokenId) private {
        uint256 value = s_tokenValue[_tokenId];
        _subtractAccountValue(_from, value);
        _addAccountValue(_to, value);
    }

    function _addAccountValue(address _account, uint256 _value) private {
        s_accountValueHistory[_account].push(_add, _value);
        s_investors.add(_account);
    }

    function _subtractAccountValue(address _account, uint256 _value) private {
        s_accountValueHistory[_account].push(_subtract, _value);
        if (balanceOf(_account) == 0) {
            s_investors.remove(_account);
        }
    }

    function _mintWithURI(address _to, uint256 _value) private {
        if (_value <= 0) revert PerpetualNFT__InvalidTokenValue();

        uint256 tokenId = s_tokenIdCounter.current();
        s_tokenIdCounter.increment();

        s_tokenValue[tokenId] = _value;
        _safeMint(_to, tokenId);
    }

    function _validateSplit(uint256 _tokenId, uint256[] calldata _values) private view {
        if (s_marketplace.getListingByTokenId(address(this), _tokenId).listed) {
            revert PerpetualFund__TokenListedOnSale();
        }

        if (_msgSender() != ownerOf(_tokenId)) revert PerpetualNFT__NotTokenOwner(_msgSender(), _tokenId);
        if (_values.length > SPLIT_LIMIT) revert PerpetualNFT__SplitLimitExceeded();
        uint256 valuesSum = 0;
        uint256 minimumNftValue = s_minimumValue;
        for (uint256 i; i < _values.length; ) {
            if (_values[i] < minimumNftValue) revert PerpetualNFT__ValueToLow();
            valuesSum += _values[i];
            unchecked {
                i++;
            }
        }
        if (valuesSum != s_tokenValue[_tokenId]) revert PerpetualNFT__TokenValuesBeforeAfterSplitMismatch();
    }

    // Function to convert uint to string
    function toString(uint256 _value) private pure returns (string memory) {
        if (_value == 0) {
            return "0";
        }
        uint256 temp = _value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (_value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(_value % 10)));
            _value /= 10;
        }
        return string(buffer);
    }

    uint256[48] private __gap;
}
