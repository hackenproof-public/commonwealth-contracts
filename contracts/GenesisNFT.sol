// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {ERC721EnumerableUpgradeable, ERC721Upgradeable, IERC165Upgradeable, IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {ERC721URIStorageUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {IERC721Mintable} from "./interfaces/IERC721Mintable.sol";

/**
 * @title Genesis NFT contract
 */
contract GenesisNFT is
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    PausableUpgradeable,
    AccessControlEnumerableUpgradeable,
    ERC2981Upgradeable,
    ERC721HolderUpgradeable,
    IERC721Mintable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    address private _owner;

    /**
     * @notice Emitted when token URI is changed
     * @param caller Address which changed token URI
     * @param tokenId ID of token for which URI was changed
     * @param uri New token URI
     */
    event TokenURIChanged(address indexed caller, uint256 indexed tokenId, string uri);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param owner_ Address of contract owner
     * @param royaltyAccount Address where to send royalty
     * @param royaltyValue Royalty value in basis points
     */
    function initialize(address owner_, address royaltyAccount, uint96 royaltyValue) public initializer {
        __ERC721_init("Common Wealth Genesis NFT", "CWOGNFT");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __Pausable_init();
        __AccessControlEnumerable_init();
        __ERC2981_init();
        __ERC721Holder_init();

        require(owner_ != address(0), "Owner account is zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(MINTER_ROLE, owner_);
        _grantRole(PAUSER_ROLE, owner_);

        _owner = owner_;

        _setDefaultRoyalty(royaltyAccount, royaltyValue);
    }

    /**
     * @notice Sets contract owner account
     * @dev Contract owner is necessary for compatibility with third-party dapps requiring ownable interface (e.g. OpenSea)
     * @param newOwner Address of new contract owner
     */
    function setOwner(address newOwner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newOwner != address(0), "New owner is zero address");

        _owner = newOwner;
    }

    /**
     * @notice Returns contract owner
     * @dev Contract owner is necessary for compatibility with third-party dapps requiring ownable interface (e.g. OpenSea)
     * @dev It is not equivalent of contract admin and has no special rights by itself. Roles are managed by AccessControl contract
     * @return Contract owner
     */
    function owner() external view returns (address) {
        return _owner;
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
     * @inheritdoc IERC721Mintable
     */
    function mint(address recipient, uint256 amount, string memory uri) external onlyRole(MINTER_ROLE) {
        require(recipient != address(0), "Recipient is zero address");

        uint256 startId = totalSupply();
        for (uint256 i = 0; i < amount; i++) {
            _mintWithURI(startId + i, recipient, uri);
        }
    }

    /**
     * @inheritdoc IERC721Mintable
     */
    function mintBatch(
        address[] memory recipients,
        uint256[] memory amounts,
        string memory uri
    ) external onlyRole(MINTER_ROLE) {
        _validateMintBatch(recipients, amounts);

        uint256 startId = totalSupply();
        for (uint256 i = 0; i < recipients.length; i++) {
            for (uint256 j = 0; j < amounts[i]; j++) {
                _mintWithURI(startId + j, recipients[i], uri);
            }
            startId += amounts[i];
        }
    }

    /**
     * @notice Burns token with id `tokenId`. Limited only to admin role
     * @param tokenId Token ID
     */
    function burn(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(tokenId);
    }

    /**
     * @notice Returns list of owners balances
     * @param accounts List of addresses for which to return balance
     * @return List of owners balances
     */
    function balanceOfBatch(address[] calldata accounts) external view returns (uint256[] memory) {
        uint256[] memory balances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            balances[i] = balanceOf(accounts[i]);
        }
        return balances;
    }

    /**
     * @notice Sets token metadata URI
     * @param tokenId ID of token to be changed
     * @param uri New metadata URI
     */
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTokenURI(tokenId, uri);
        emit TokenURIChanged(msg.sender, tokenId, uri);
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
    )
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlEnumerableUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return interfaceId == type(IERC721Mintable).interfaceId || super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
        _resetTokenRoyalty(tokenId);
    }

    function _mintWithURI(uint256 tokenId, address to, string memory uri) private {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function _validateMintBatch(address[] memory recipients, uint256[] memory amounts) private pure {
        require(recipients.length == amounts.length, "Recipients and amounts length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Recipient is zero address");
            require(amounts[i] > 0, "Tokens amount is equal to zero");
        }
    }

    uint256[49] private __gap;
}
