// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {ERC721EnumerableUpgradeable, IERC165Upgradeable, IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {IZkSync} from "@matterlabs/zksync-contracts/l1/contracts/zksync/interfaces/IZkSync.sol";
import {IERC721Mintable} from "./interfaces/IERC721Mintable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {IGenesisNFT} from "./interfaces/IGenesisNFT.sol";

interface ZkSyncGenesisNFTmirror {
    function moveToken(uint, address) external;

    function destroyToken(uint) external;
}

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

    uint256 public constant ZK_SYNC_GAS_LIMIT = 2_000_000; // 2x of what we need according to a current network state
    uint256 public constant ZK_SYNC_GAS_PER_PUBDATA_LIMIT = 800; // from zkSync docs

    address private _owner;
    string private _tokenURI;
    uint256 private _series;
    address public _zkSyncBridge;
    address public _zkSyncMirror;

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
     * @param name_ NFT collection name
     * @param symbol_ NFT collection symbol
     * @param series_ Genesis NFT series number
     * @param owner_ Address of contract owner
     * @param royaltyAccount Address where to send royalty
     * @param royaltyValue Royalty value in basis points
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 series_,
        address owner_,
        address royaltyAccount,
        uint96 royaltyValue,
        string memory tokenUri
    ) public initializer {
        __ERC721_init(name_, symbol_);
        __ERC721Enumerable_init();
        __Pausable_init();
        __AccessControlEnumerable_init();
        __ERC2981_init();
        __ERC721Holder_init();

        require(owner_ != address(0), "Owner account is zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(MINTER_ROLE, owner_);
        _grantRole(PAUSER_ROLE, owner_);

        _owner = owner_;
        _tokenURI = tokenUri;
        _series = series_;

        _setDefaultRoyalty(royaltyAccount, royaltyValue);
    }

    /**
     * @inheritdoc IGenesisNFT
     */
    function getSeries() external view returns (uint256) {
        return _series;
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
    function mint(address recipient, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(recipient != address(0), "Recipient is zero address");

        uint256 startId = totalSupply();
        for (uint256 i = 0; i < amount; i++) {
            _safeMint(recipient, startId + i);
        }
    }

    /**
     * @notice Mints new token(s) to a recipient and notifies zkSync mirror about it. Limited only to minter role
     * @param recipient tokens recipient
     * @param amount tokens amount
     */
    function mintNotify(address recipient, uint256 amount) external payable onlyRole(MINTER_ROLE) {
        require(recipient != address(0), "Recipient is zero address");
        uint256 valuePerToken = msg.value / amount;

        uint256 startId = totalSupply();
        for (uint256 i = 0; i < amount; i++) {
            _safeMint(recipient, startId + i);
            _notifyZkSyncMirrorMove(startId + i, recipient, valuePerToken);
        }
    }

    /**
     * @inheritdoc IERC721Mintable
     */
    function mintBatch(address[] memory recipients, uint256[] memory amounts) external onlyRole(MINTER_ROLE) {
        _validateMintBatch(recipients, amounts);

        uint256 startId = totalSupply();
        for (uint256 i = 0; i < recipients.length; i++) {
            for (uint256 j = 0; j < amounts[i]; j++) {
                _safeMint(recipients[i], startId + j);
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
     * @notice Burns token with id `tokenId` and notifies zkSync mirror about it. Limited only to admin role
     * @param tokenId Token ID
     */
    function burnNotify(uint256 tokenId) external payable onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(tokenId);
        _notifyZkSyncMirrorDestroy(tokenId, msg.value);
    }

    // TODO: disable this
    //    /**
    //     * @dev See {IERC721-transferFrom}.
    //     */
    //    function transferFrom(
    //        address from,
    //        address to,
    //        uint256 tokenId
    //    ) public virtual override(IERC721Upgradeable, ERC721Upgradeable) {
    //        revert("This was disabled. Use transferFromNotify(address,address,uint256) !");
    //    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFromNotify(address from, address to, uint256 tokenId) public payable {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: caller is not token owner or approved");

        _transfer(from, to, tokenId);
        _notifyZkSyncMirrorMove(tokenId, to, msg.value);
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
     * @notice Sets metadata URI for all tokens
     * @param uri New metadata URI
     */
    function setTokenURI(string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _tokenURI = uri;
        emit TokenURIChanged(msg.sender, uri);
    }

    /**
     * @notice Sets zkSync bridge address
     * @param zkSyncBridge New metadata URI
     */
    function setZkSyncBridge(address zkSyncBridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(zkSyncBridge != address(0), "this address is zero");

        _zkSyncBridge = zkSyncBridge;
    }

    /**
     * @notice Sets zkSync mirror address
     * @param zkSyncMirror New metadata URI
     */
    function setZkSyncMirror(address zkSyncMirror) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(zkSyncMirror != address(0), "this address is zero");

        _zkSyncMirror = zkSyncMirror;
    }

    /**
     * @inheritdoc IERC721MetadataUpgradeable
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        return _tokenURI;
    }

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721EnumerableUpgradeable, AccessControlEnumerableUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IERC721Mintable).interfaceId ||
            interfaceId == type(IGenesisNFT).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);
        _resetTokenRoyalty(tokenId);
    }

    function _validateMintBatch(address[] memory recipients, uint256[] memory amounts) private pure {
        require(recipients.length == amounts.length, "Recipients and amounts length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Recipient is zero address");
            require(amounts[i] > 0, "Tokens amount is equal to zero");
        }
    }

    function _notifyZkSyncMirrorMove(uint256 tokenId, address recipient, uint256 value) internal {
        require(
            value >= ZK_SYNC_GAS_LIMIT,
            "Not enough ether sent with the invokation! Send at least ZK_SYNC_GAS_LIMIT GWei!"
        );

        if (_zkSyncMirror != address(0) && _zkSyncBridge != address(0)) {
            bytes memory data = abi.encodeWithSelector(ZkSyncGenesisNFTmirror.moveToken.selector, tokenId, recipient);

            IZkSync zksync = IZkSync(_zkSyncBridge);
            bytes32 txHash = zksync.requestL2Transaction{value: value}(
                _zkSyncMirror,
                0,
                data,
                ZK_SYNC_GAS_LIMIT,
                ZK_SYNC_GAS_PER_PUBDATA_LIMIT,
                new bytes[](0),
                msg.sender
            );
            emit TokenMoved(tokenId, recipient, txHash);
        }
    }

    function _notifyZkSyncMirrorDestroy(uint256 tokenId, uint256 value) internal {
        require(
            value >= ZK_SYNC_GAS_LIMIT,
            "Not enough ether sent with the invokation! Send at least ZK_SYNC_GAS_LIMIT Wei!"
        );

        if (_zkSyncMirror != address(0) && _zkSyncBridge != address(0)) {
            bytes memory data = abi.encodeWithSelector(ZkSyncGenesisNFTmirror.destroyToken.selector, tokenId);

            IZkSync zksync = IZkSync(_zkSyncBridge);
            bytes32 txHash = zksync.requestL2Transaction{value: value}(
                _zkSyncMirror,
                0,
                data,
                ZK_SYNC_GAS_LIMIT,
                ZK_SYNC_GAS_PER_PUBDATA_LIMIT,
                new bytes[](0),
                msg.sender
            );
            emit TokenMoved(tokenId, address(0), txHash);
        }
    }

    uint256[45] private __gap;
}
