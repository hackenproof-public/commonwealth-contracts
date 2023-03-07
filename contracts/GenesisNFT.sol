// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./interfaces/IERC721Mintable.sol";

/**
 * @title Genesis NFT contract
 */
contract GenesisNFT is
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ERC2981Upgradeable,
    ERC721HolderUpgradeable,
    IERC721Mintable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /**
     * @notice Contract owner
     * @dev Gets following roles on contract creation: DefaultAdmin, Minter, Pauser
     */
    address public owner;

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
        __ERC721_init("Common Wealth Genesis NFT", "CWGNFT");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __Pausable_init();
        __AccessControl_init();
        __ERC2981_init();

        require(owner_ != address(0), "Owner account is zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(MINTER_ROLE, owner_);
        _grantRole(PAUSER_ROLE, owner_);

        owner = owner_;

        _setDefaultRoyalty(royaltyAccount, royaltyValue);
    }

    /**
     * @notice Transfer ownership with its default roles to new address
     * @param newOwner Address of new contract owner
     */
    function transferOwnership(address newOwner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newOwner != address(0), "New owner is zero address");

        grantRole(PAUSER_ROLE, newOwner);
        grantRole(MINTER_ROLE, newOwner);
        grantRole(DEFAULT_ADMIN_ROLE, newOwner);
        revokeRole(PAUSER_ROLE, owner);
        revokeRole(MINTER_ROLE, owner);
        revokeRole(DEFAULT_ADMIN_ROLE, owner);

        owner = newOwner;
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
     * @notice Mints token to address with specified URI
     * @param recipient Address of token recipient
     * @param amount Amount of unique tokens to be minted
     * @param uri URI of token metadata
     */
    function mint(address recipient, uint256 amount, string memory uri) external onlyRole(MINTER_ROLE) {
        require(recipient != address(0), "Recipient is zero address");

        uint256 startId = totalSupply();
        for (uint256 i = 0; i < amount; i++) {
            _mintWithURI(startId + i, recipient, uri);
        }
    }

    /**
     * @notice Mints `amount` number of unique tokens to addresses with specified URI in batch
     * @param recipients List of addresses of token recipients
     * @param amounts List of amounts of tokens to be minted
     * @param uri URI of token metadata
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
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable, ERC2981Upgradeable)
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
