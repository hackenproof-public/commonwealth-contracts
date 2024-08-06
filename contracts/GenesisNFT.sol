// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {IERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721Upgradeable, IERC165Upgradeable, IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {IERC721Mintable} from "./interfaces/IERC721Mintable.sol";
import {IGenesisNFT} from "./interfaces/IGenesisNFT.sol";
import {IGenesisNFTVesting} from "./interfaces/IGenesisNFTVesting.sol";
import {IMarketplace} from "./interfaces/IMarketplace.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

error GenesisNFT__ZeroAddress();
error GenesisNFT__LengthMismatch();
error GenesisNFT__ZeroAmount();
error GenesisNFT__EmptyString(string field);

/**
 * @title Genesis NFT contract
 */
contract GenesisNFT is
    ERC721EnumerableUpgradeable,
    PausableUpgradeable,
    AccessControlEnumerableUpgradeable,
    ERC2981Upgradeable,
    ERC721HolderUpgradeable,
    IERC721Mintable,
    IGenesisNFT
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    address private s_owner;
    string private s_tokenURI;
    uint256 private s_series;
    uint256 private token_allocation;
    bool private series1;

    Metadata public metadata;
    string[] public metadataImages;

    IGenesisNFTVesting public genesisNFTVesting;
    IMarketplace private s_marketplace;

    /**
     * @notice Emitted when token URI is changed
     * @param caller Address which changed token URI
     * @param uri New token URI
     */
    event TokenURIChanged(address indexed caller, string uri);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param _name NFT collection name
     * @param _symbol NFT collection symbol
     * @param _series Genesis NFT series number
     * @param _owner Address of contract owner
     * @param _royaltyAccount Address where to send royalty
     * @param _royaltyValue Royalty value in basis points
     * @param _tokenUri Base token URI
     * @param _metadata Metadata structure
     * @param _token_allocation Metadata structure
     * @param _series1 Metadata structure
     * @param _metadataImages Metadata structure
     */
    function initialize(
        string memory _name,
        string memory _symbol,
        uint256 _series,
        address _owner,
        address _royaltyAccount,
        uint96 _royaltyValue,
        string memory _tokenUri,
        Metadata memory _metadata,
        uint256 _token_allocation,
        bool _series1,
        string[] memory _metadataImages
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __ERC721Enumerable_init();
        __Pausable_init();
        __AccessControlEnumerable_init();
        __ERC2981_init();
        __ERC721Holder_init();

        if (_owner == address(0)) revert GenesisNFT__ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(MINTER_ROLE, _owner);
        _grantRole(PAUSER_ROLE, _owner);

        s_owner = _owner;
        s_tokenURI = _tokenUri;
        s_series = _series;

        _setDefaultRoyalty(_royaltyAccount, _royaltyValue);

        metadata = Metadata({
            name: _metadata.name,
            description: _metadata.description,
            externalUrl: _metadata.externalUrl,
            id: _metadata.id,
            percentage: _metadata.percentage
        });
        token_allocation = _token_allocation;
        series1 = _series1;
        metadataImages = _metadataImages;
    }

    /**
     * @inheritdoc IERC721Mintable
     */
    function mint(address _recipient, uint256 _amount) external onlyRole(MINTER_ROLE) {
        if (_recipient == address(0)) revert GenesisNFT__ZeroAddress();
        if (_amount == 0) revert GenesisNFT__ZeroAmount();

        uint256 startId = totalSupply();
        for (uint256 i = 0; i < _amount; i++) {
            _safeMint(_recipient, startId + i);
        }
    }

    /**
     * @notice Mints tokens with specific IDs
     * @param _recipient Address to mint tokens to
     * @param _tokenIds Array of token IDs to mint
     */
    function mintWithIds(address _recipient, uint256[] memory _tokenIds) external onlyRole(MINTER_ROLE) {
        if (_recipient == address(0)) revert GenesisNFT__ZeroAddress();

        for (uint256 i = 0; i < _tokenIds.length; ) {
            _safeMint(_recipient, _tokenIds[i]);
            unchecked {
                i++;
            }
        }
    }

    /**
     * @inheritdoc IERC721Mintable
     */
    function mintBatch(address[] memory _recipients, uint256[] memory _amounts) external onlyRole(MINTER_ROLE) {
        _validateMintBatch(_recipients, _amounts);

        uint256 startId = totalSupply();
        for (uint256 i = 0; i < _recipients.length; i++) {
            for (uint256 j = 0; j < _amounts[i]; j++) {
                _safeMint(_recipients[i], startId + j);
            }
            startId += _amounts[i];
        }
    }

        function approve(address to, uint256 tokenId) public virtual override(ERC721Upgradeable, IERC721Upgradeable) {
        super.approve(to,tokenId);
        if(s_marketplace.getListingByTokenId(address(this), tokenId).listed && to==address(0)){
            s_marketplace.cancelListing(address(this), tokenId);
        }
    }

    function setApprovalForAll(address operator, bool approved) public virtual override(ERC721Upgradeable, IERC721Upgradeable) {
        super.setApprovalForAll(operator, approved);
        uint256 balance = balanceOf(_msgSender());
        for(uint256 i; i<balance;){
            uint256 tokenId = tokenOfOwnerByIndex(_msgSender(), i);
            if(s_marketplace.getListingByTokenId(address(this), tokenId).listed){
            s_marketplace.cancelListing(address(this), tokenId);
        }
            unchecked {
                i++;
            }
        }
    }

    function setMarketplaceAddress(address _address) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_address == address(0)) revert GenesisNFT__ZeroAddress();
        s_marketplace = IMarketplace(_address);
    }

    /**
     * @notice Sets contract owner account
     * @dev Contract owner is necessary for compatibility with third-party dapps requiring ownable interface (e.g. OpenSea)
     * @param _newOwner Address of new contract owner
     */
    function setOwner(address _newOwner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newOwner == address(0)) revert GenesisNFT__ZeroAddress();

        emit OwnershipTransferred(s_owner, _newOwner);
        s_owner = _newOwner;
    }

    /**
     * @notice Sets Genesis NFT Vesting address
     * @dev Sets up the contract address for Genesis NFT Vesting
     * @param _vestingContractAddress Address of Genesis NFT Vesting contract
     */
    function setVestingAddress(address _vestingContractAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_vestingContractAddress == address(0)) revert GenesisNFT__ZeroAddress();
        genesisNFTVesting = IGenesisNFTVesting(_vestingContractAddress);
    }

    /**
     * @inheritdoc IGenesisNFT
     */ function setMetadataName(string memory _name) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(_name).length == 0) revert GenesisNFT__EmptyString("name");
        metadata.name = _name;

        emit MetadataNameChanged(_name);
    }

    /**
     * @inheritdoc IGenesisNFT
     */ function setMetadataDescription(string memory _description) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(_description).length == 0) revert GenesisNFT__EmptyString("description");
        metadata.description = _description;

        emit MetadataDescriptionChanged(_description);
    }

    /**
     * @inheritdoc IGenesisNFT
     */ function setMetadataImage(string[] memory _metadataImages) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_metadataImages.length != 11) revert GenesisNFT__LengthMismatch();
        metadataImages = _metadataImages;

        emit MetadataImageChanged(_metadataImages);
    }

    /**
     * @inheritdoc IGenesisNFT
     */ function setMetadataExternalUrl(string memory _externalUrl) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(_externalUrl).length == 0) revert GenesisNFT__EmptyString("externalUrl");
        metadata.externalUrl = _externalUrl;

        emit MetadataExternalUrlChanged(_externalUrl);
    }

    /**
     * @inheritdoc IGenesisNFT
     */ function setMetadataId(string memory _id) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(_id).length == 0) revert GenesisNFT__EmptyString("id");
        metadata.id = _id;

        emit MetadataIdChanged(_id);
    }

    /**
     * @inheritdoc IGenesisNFT
     */ function setMetadataPercentage(string memory _percentage) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(_percentage).length == 0) revert GenesisNFT__EmptyString("percentage");
        metadata.percentage = _percentage;

        emit MetadataPercentageChanged(_percentage);
    }

    /**
     * @inheritdoc IGenesisNFT
     */ function setAllMetadata(Metadata memory _metadata) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(_metadata.name).length == 0) revert GenesisNFT__EmptyString("name");
        if (bytes(_metadata.description).length == 0) revert GenesisNFT__EmptyString("description");
        if (bytes(_metadata.externalUrl).length == 0) revert GenesisNFT__EmptyString("externalUrl");
        if (bytes(_metadata.id).length == 0) revert GenesisNFT__EmptyString("id");
        if (bytes(_metadata.percentage).length == 0) revert GenesisNFT__EmptyString("percentage");

        metadata.name = _metadata.name;
        metadata.description = _metadata.description;
        metadata.externalUrl = _metadata.externalUrl;
        metadata.id = _metadata.id;
        metadata.percentage = _metadata.percentage;

        emit MetadataChanged(_metadata.name, _metadata.description, _metadata.externalUrl, _metadata.id, _metadata.percentage);
    }

    /**
     * @inheritdoc IGenesisNFT
     */ function setTokenAllocation(uint256 _token_allocation) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        token_allocation = _token_allocation;

        emit TokenAllocationChanged(_token_allocation);
    }

    /**
     * @inheritdoc IGenesisNFT
     */ function setSeries1(bool _series1) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        series1 = _series1;

        emit Series1Changed(_series1);
    }

    /**
     * @notice Disables operations on contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Enables operations on contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Burns token with id `tokenId`. Limited only to admin role
     * @param _tokenId Token ID
     */
    function burn(uint256 _tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(_tokenId);
    }

    /**
     * @notice Returns list of owners balances
     * @param _accounts List of addresses for which to return balance
     * @return List of owners balances
     */
    function balanceOfBatch(address[] calldata _accounts) external view returns (uint256[] memory) {
        uint256[] memory balances = new uint256[](_accounts.length);
        for (uint256 i = 0; i < _accounts.length; i++) {
            balances[i] = balanceOf(_accounts[i]);
        }
        return balances;
    }

    /**
     * @notice Checks if token with id `tokenId` exists
     * @param _tokenId Token ID
     */
    function exists(uint256 _tokenId) external view returns (bool) {
        return _exists(_tokenId);
    }

    /**
     * @inheritdoc IGenesisNFT
     */
    function getSeries() external view returns (uint256) {
        return s_series;
    }

    /**
     * @notice Returns Unvested Tokens
     * @return Tokens unclaimed tokens
     */
    function fetchTokenDetails(uint256 _tokenId)
        private view
        returns (string memory)
    {
        IGenesisNFTVesting.TokenDetails memory details = genesisNFTVesting.getTokenDetails(series1, _tokenId);
        return Strings.toString((details.unvested + details.vested - details.claimed - details.penalty)/1000000000000000000); // Access the first element
    }

    /**
     * @notice Returns Number of Slices
     * @return Number of slices
     */
    function getSlices(uint256 _tokenId)
        private view
        returns (uint256)
    {
        IGenesisNFTVesting.TokenDetails memory details = genesisNFTVesting.getTokenDetails(series1, _tokenId);
        uint256 slices = (details.unvested + details.vested - details.claimed - details.penalty) / (token_allocation / 10);
        if (slices > 10) {
            slices = 10;
        }
        return slices; // Access the first element
    }

    /**
     * @notice Returns token allocation
     * @return token_allocation
     */
    function getTokenAllocation() external view returns (uint256) {
        return token_allocation;
    }

    /**
     * @notice Returns series1 boolean
     * @return series1
     */
    function getSeries1() external view returns (bool) {
        return series1;
    }

    /**
     * @notice Returns image url at the index
     * @param index index of the element
     * @return image_url image url at the index 
     */
    function getMetadataImageAtIndex(uint256 index) external view returns (string memory) {
        require(index < metadataImages.length, "Index out of bounds");
        return metadataImages[index];
    }

    /**
     * @notice Returns contract owner
     * @dev Contract owner is necessary for compatibility with third-party dapps requiring ownable interface (e.g. OpenSea)
     * @dev It is not equivalent of contract admin and has no special rights by itself. Roles are managed by AccessControl contract
     * @return Contract owner
     */
    function owner() external view returns (address) {
        return s_owner;
    }

    /**
     * @inheritdoc IERC721MetadataUpgradeable
     */
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable) returns (string memory) {
        _requireMinted(tokenId);
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
                        metadataImages[getSlices(tokenId)],
                        '",',
                        '"external_url": "',
                        metadata.externalUrl,
                        '",',
                        '"series_id": "',
                        metadata.id,
                        '",',
                        '"attributes": [{"trait_type":"WLTH tokens allocation","value":"',
                        fetchTokenDetails(tokenId),
                        '"},{"trait_type":"profit share","value":"',
                        metadata.percentage,
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
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(
        bytes4 _interfaceId
    )
        public
        view
        override(ERC721EnumerableUpgradeable, AccessControlEnumerableUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            _interfaceId == type(IERC721Mintable).interfaceId ||
            _interfaceId == type(IGenesisNFT).interfaceId ||
            super.supportsInterface(_interfaceId);
    }

    function _beforeTokenTransfer(
        address _from,
        address _to,
        uint256 _tokenId,
        uint256 _batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(_from, _to, _tokenId, _batchSize);
    }

    function _burn(uint256 _tokenId) internal override {
        super._burn(_tokenId);
        _resetTokenRoyalty(_tokenId);
    }

    function _validateMintBatch(address[] memory _recipients, uint256[] memory _amounts) private pure {
        if (_recipients.length != _amounts.length) revert GenesisNFT__LengthMismatch();

        for (uint256 i = 0; i < _recipients.length; i++) {
            if (_recipients[i] == address(0)) revert GenesisNFT__ZeroAddress();
            if (_amounts[i] == 0) revert GenesisNFT__ZeroAmount();
        }
    }

    uint256[39] private __gap;
}
