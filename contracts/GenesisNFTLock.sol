// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import {OwnablePausable} from "./OwnablePausable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IGeneisNFTMirror} from "./interfaces/IGenesisNFTMirror.sol";
import {IGenesisNFTLock} from "./interfaces/IGenesisNFTLock.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {IZkSync} from "@matterlabs/zksync-contracts/l1/contracts/zksync/interfaces/IZkSync.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

error GenesisNFTLock__NotEnoughGas();
error GenesisNFTLock__OwnerZeroAddress();
error GenesisNFTLock__NFTSeries1ZeroAddress();
error GenesisNFTLock__NFTSeries2ZeroAddress();
error GenesisNFTLock__ZkSyncMirrorZeroAddress();
error GenesisNFTLock__ZkSyncBridgeZeroAddress();
error GenesisNFTLock__TokensLimitReached();
error GenesisNFTLock_NotTokenOwner(uint256 tokenId, address account);
error GenesisNFTLock__GasPerPubDataLimitZero();
error GenesisNFTLock__TokensEmptyIds();

/**
 * @title GenesisNFTLock
 * @notice Contract representing the locking functionality for NFTs.
 */
contract GenesisNFTLock is IGenesisNFTLock, OwnablePausable, ERC721HolderUpgradeable, ReentrancyGuardUpgradeable {
    event ZkSyncNotified(
        OperationType operationType,
        uint8 indexed sieries,
        uint256[] tokenIds,
        address indexed to,
        bytes32 indexed txHash
    );

    uint256 public constant TOKENS_LIMIT = 160;

    address private s_series1Nft;
    address private s_series2Nft;

    IZkSync private s_zkSyncBridge;
    address private s_zkSyncGenesisNFT1Mirror;
    address private s_zkSyncGenesisNFT2Mirror;

    uint256 private s_zkSyncGasPerPubdataLimit;

    mapping(address => uint256[]) private s_series1LockedTokens;
    mapping(address => uint256[]) private s_series2LockedTokens;
    mapping(uint256 => address) private s_series1LockedTokenOwner;
    mapping(uint256 => address) private s_series2LockedTokenOwner;
    mapping(address => mapping(uint256 => uint256)) s_series1LockedTokenIndex;
    mapping(address => mapping(uint256 => uint256)) s_series2LockedTokenIndex;

    modifier enoughGas(uint256 _value, uint256 _gasLimit) {
        if (_value < _gasLimit) revert GenesisNFTLock__NotEnoughGas();
        _;
    }

    modifier tokensLimit(uint256 tokens) {
        if (tokens > TOKENS_LIMIT) {
            revert GenesisNFTLock__TokensLimitReached();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with the specified parameters.
     * @param _owner The address that will be set as the owner of the contract.
     * @param _series1Nft The address of the Series 1 NFT contract.
     * @param _series2Nft The address of the Series 2 NFT contract.
     * @param _zkSyncGasPerPubdataLimit The gas limit for ZkSync transactions.
     */
    function initialize(
        address _owner,
        address _series1Nft,
        address _series2Nft,
        uint256 _zkSyncGasPerPubdataLimit
    ) public initializer {
        if (_owner == address(0)) revert GenesisNFTLock__OwnerZeroAddress();
        if (_series1Nft == address(0)) revert GenesisNFTLock__NFTSeries1ZeroAddress();
        if (_series2Nft == address(0)) revert GenesisNFTLock__NFTSeries2ZeroAddress();
        if (_zkSyncGasPerPubdataLimit == 0) revert GenesisNFTLock__GasPerPubDataLimitZero();

        s_series1Nft = _series1Nft;
        s_series2Nft = _series2Nft;
        s_zkSyncGasPerPubdataLimit = _zkSyncGasPerPubdataLimit;
        __OwnablePausable_init(_owner);
        __ReentrancyGuard_init();
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function lockSeries1Tokens(
        uint256[] memory _ids,
        address _account,
        uint256 _gasLimit
    ) external payable override enoughGas(msg.value, _gasLimit) tokensLimit(_ids.length) nonReentrant {
        if (_ids.length == 0) {
            revert GenesisNFTLock__TokensEmptyIds();
        }
        uint256 nextLockTokenIndex = s_series1LockedTokens[_account].length;
        IERC721Upgradeable nft = IERC721Upgradeable(s_series1Nft);
        for (uint256 i; i < _ids.length; ) {
            s_series1LockedTokenOwner[_ids[i]] = _account;
            s_series1LockedTokens[_account].push(_ids[i]);
            s_series1LockedTokenIndex[_account][_ids[i]] = nextLockTokenIndex;
            nft.safeTransferFrom(_account, address(this), _ids[i]);

            unchecked {
                nextLockTokenIndex++;
                i++;
            }
        }

        _notifyZkSync(OperationType.ASSIGN, 1, _ids, _account, msg.value, _gasLimit);
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function unlockSeries1Tokens(
        uint256[] memory _ids,
        uint256 _gasLimit
    ) external payable override enoughGas(msg.value, _gasLimit) tokensLimit(_ids.length) nonReentrant {
        IERC721Upgradeable nft = IERC721Upgradeable(s_series1Nft);
        if (_ids.length == 0) {
            revert GenesisNFTLock__TokensEmptyIds();
        }
        uint256[] memory lockedTokens = s_series1LockedTokens[msg.sender];
        uint256 deletedIndicies;
        for (uint256 i; i < _ids.length; ) {
            if (s_series1LockedTokenOwner[_ids[i]] != msg.sender) {
                revert GenesisNFTLock_NotTokenOwner(_ids[i], msg.sender);
            }

            uint256 tokenIndex = s_series1LockedTokenIndex[msg.sender][_ids[i]];
            uint256 lastTokenIndex = lockedTokens.length - 1 - deletedIndicies;

            if (tokenIndex != lastTokenIndex) {
                s_series1LockedTokens[msg.sender][tokenIndex] = lockedTokens[lastTokenIndex];
                s_series1LockedTokenIndex[msg.sender][lockedTokens[lastTokenIndex]] = tokenIndex;
            }

            s_series1LockedTokens[msg.sender].pop();
            delete s_series1LockedTokenIndex[msg.sender][_ids[i]];
            delete s_series1LockedTokenOwner[_ids[i]];

            nft.safeTransferFrom(address(this), msg.sender, _ids[i]);

            unchecked {
                i++;
                deletedIndicies++;
            }
        }
        _notifyZkSync(OperationType.UNASSIGN, 1, _ids, msg.sender, msg.value, _gasLimit);
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function lockSeries2Tokens(
        uint256[] memory _ids,
        address _accouunt,
        uint256 _gasLimit
    ) external payable override enoughGas(msg.value, _gasLimit) tokensLimit(_ids.length) nonReentrant {
        if (_ids.length == 0) {
            revert GenesisNFTLock__TokensEmptyIds();
        }
        uint256 nextLockTokenIndex = s_series2LockedTokens[_accouunt].length;
        IERC721Upgradeable nft = IERC721Upgradeable(s_series2Nft);
        for (uint256 i; i < _ids.length; ) {
            s_series2LockedTokenOwner[_ids[i]] = _accouunt;
            s_series2LockedTokens[_accouunt].push(_ids[i]);
            s_series2LockedTokenIndex[_accouunt][_ids[i]] = nextLockTokenIndex;
            nft.safeTransferFrom(_msgSender(), address(this), _ids[i]);
            unchecked {
                nextLockTokenIndex++;
                i++;
            }
        }

        _notifyZkSync(OperationType.ASSIGN, 2, _ids, _accouunt, msg.value, _gasLimit);
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function unlockSeries2Tokens(
        uint256[] memory _ids,
        uint256 _gasLimit
    ) external payable override enoughGas(msg.value, _gasLimit) tokensLimit(_ids.length) nonReentrant {
        IERC721Upgradeable nft = IERC721Upgradeable(s_series2Nft);
        if (_ids.length == 0) {
            revert GenesisNFTLock__TokensEmptyIds();
        }
        uint256[] memory lockedTokens = s_series2LockedTokens[msg.sender];
        uint256 deletedIndicies;
        for (uint256 i; i < _ids.length; ) {
            if (s_series2LockedTokenOwner[_ids[i]] != msg.sender) {
                revert GenesisNFTLock_NotTokenOwner(_ids[i], msg.sender);
            }

            uint256 tokenIndex = s_series2LockedTokenIndex[msg.sender][_ids[i]];
            uint256 lastTokenIndex = lockedTokens.length - 1 - deletedIndicies;

            if (tokenIndex != lastTokenIndex) {
                s_series2LockedTokens[msg.sender][tokenIndex] = lockedTokens[lastTokenIndex];
                s_series2LockedTokenIndex[msg.sender][lockedTokens[lastTokenIndex]] = tokenIndex;
            }

            s_series2LockedTokens[msg.sender].pop();
            delete s_series2LockedTokenIndex[msg.sender][_ids[i]];
            delete s_series2LockedTokenOwner[_ids[i]];

            nft.safeTransferFrom(address(this), msg.sender, _ids[i]);

            unchecked {
                i++;
                deletedIndicies++;
            }
        }
        _notifyZkSync(OperationType.UNASSIGN, 2, _ids, msg.sender, msg.value, _gasLimit);
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function setZkSyncBridge(address _zkSyncBridge) external override onlyOwner {
        if (_zkSyncBridge == address(0)) {
            revert GenesisNFTLock__ZkSyncBridgeZeroAddress();
        }

        s_zkSyncBridge = IZkSync(_zkSyncBridge);
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function setZkSyncGenesisNFT1Mirror(address _zkSyncMirror) external override onlyOwner {
        if (_zkSyncMirror == address(0)) {
            revert GenesisNFTLock__ZkSyncMirrorZeroAddress();
        }

        s_zkSyncGenesisNFT1Mirror = _zkSyncMirror;
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function setZkSyncGenesisNFT2Mirror(address _zkSyncMirror) external override onlyOwner {
        if (_zkSyncMirror == address(0)) {
            revert GenesisNFTLock__ZkSyncMirrorZeroAddress();
        }

        s_zkSyncGenesisNFT2Mirror = _zkSyncMirror;
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function setZkSyncGasPerPubdataLimit(uint256 _zkSyncGasPerPubdataLimit) external override onlyOwner {
        if (_zkSyncGasPerPubdataLimit == 0) {
            revert GenesisNFTLock__GasPerPubDataLimitZero();
        }
        s_zkSyncGasPerPubdataLimit = _zkSyncGasPerPubdataLimit;
    }

    /**
     * @dev Notifies the ZkSync bridge about a series operation and initiates corresponding mirrored NFT changes.
     * @param _operationType The type of operation (ASSIGN or UNASSIGN).
     * @param _series The series number (1 or 2).
     * @param _ids The array of token IDs involved in the operation.
     * @param _recipient The address to which the operation is applied.
     * @param _value The amount of value to be sent with the notification.
     * @param _gasLimit The gas limit for the L2 transaction.
     */
    function _notifyZkSync(
        OperationType _operationType,
        uint8 _series,
        uint256[] memory _ids,
        address _recipient,
        uint256 _value,
        uint256 _gasLimit
    ) private {
        address zkSyncMirror = _series == 1 ? s_zkSyncGenesisNFT1Mirror : s_zkSyncGenesisNFT2Mirror;
        if (zkSyncMirror == address(0)) {
            revert GenesisNFTLock__ZkSyncMirrorZeroAddress();
        }
        if (address(s_zkSyncBridge) == address(0)) {
            revert GenesisNFTLock__ZkSyncBridgeZeroAddress();
        }
        bytes memory data = _operationType == OperationType.ASSIGN
            ? abi.encodeWithSelector(IGeneisNFTMirror.assign.selector, _ids, _recipient)
            : abi.encodeWithSelector(IGeneisNFTMirror.unassign.selector, _ids, _recipient);

        bytes32 txHash = s_zkSyncBridge.requestL2Transaction{value: _value}(
            zkSyncMirror,
            0,
            data,
            _gasLimit,
            s_zkSyncGasPerPubdataLimit,
            new bytes[](0),
            msg.sender
        );

        emit ZkSyncNotified(_operationType, _series, _ids, _recipient, txHash);
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function series1Nft() external view override returns (address) {
        return s_series1Nft;
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function series2Nft() external view override returns (address) {
        return s_series2Nft;
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function zkSyncBridge() external view override returns (address) {
        return address(s_zkSyncBridge);
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function zkSyncGenesisNFT1Mirror() external view override returns (address) {
        return s_zkSyncGenesisNFT1Mirror;
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function zkSyncGenesisNFT2Mirror() external view override returns (address) {
        return s_zkSyncGenesisNFT2Mirror;
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function zkSyncGasPerPubdataLimit() external view override returns (uint256) {
        return s_zkSyncGasPerPubdataLimit;
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function series1LockedTokens(address _account) external view override returns (uint256[] memory) {
        return s_series1LockedTokens[_account];
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function series2LockedTokens(address _account) external view override returns (uint256[] memory) {
        return s_series2LockedTokens[_account];
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function series1LockedTokenOwner(uint256 _tokenId) external view override returns (address) {
        return s_series1LockedTokenOwner[_tokenId];
    }

    /**
     * @inheritdoc IGenesisNFTLock
     */
    function series2LockedTokenOwner(uint256 _tokenId) external view override returns (address) {
        return s_series2LockedTokenOwner[_tokenId];
    }

    uint256[48] private __gap;
}
