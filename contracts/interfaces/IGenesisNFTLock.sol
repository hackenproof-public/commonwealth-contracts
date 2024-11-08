// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title IGenesisNFTLock
 * @notice Interface for the GenesisNFTLock contract, responsible for locking and unlocking NFTs
 * in two different series, interacting with a zkSync bridge.
 */
interface IGenesisNFTLock {
    enum OperationType {
        ASSIGN,
        UNASSIGN
    }

    /**
     * @notice Event emitted when the zkSync bridge is notified about a locked or unlocked NFT.
     */
    event ZkSyncNotified(
        OperationType operationType,
        uint8 indexed sieries,
        uint256[] tokenIds,
        address indexed to,
        bytes32 indexed txHash
    );

    /**
     * @notice Event emitted when the gas per pubdata limit is set.
     */
    event ZkSyncGasPerPubdataLimitSet(uint256 indexed gasLimit);

    /**
     * @notice Event emitted when the zkSync bridge address is set.
     */
    event ZkSyncBridgeSet(address indexed zkSyncBridge);

    /**
     * @notice Event emitted when the zkSync mirror address for Series 1 NFTs is set.
     */
    event GenesisNftMirror1Set(address indexed genesisNftMirror1);

    /**
     * @notice Event emitted when the zkSync mirror address for Series 2 NFTs is set.
     */
    event GenesisNftMirror2Set(address indexed genesisNftMirror2);

    /**
     * @notice Locks Series 1 tokens for a given account.
     * @param _ids Array of token IDs to lock.
     * @param _account Address of the account.
     * @param _gasLimit Gas limit for the transaction.
     */
    function lockSeries1Tokens(uint256[] memory _ids, address _account, uint256 _gasLimit) external payable;

    /**
     * @notice Unlocks Series 1 tokens for the caller.
     * @param _ids Array of token IDs to unlock.
     * @param _gasLimit Gas limit for the transaction.
     */
    function unlockSeries1Tokens(uint256[] memory _ids, uint256 _gasLimit) external payable;

    /**
     * @notice Locks Series 2 tokens for a given account.
     * @param _ids Array of token IDs to lock.
     * @param _account Address of the account.
     * @param _gasLimit Gas limit for the transaction.
     */
    function lockSeries2Tokens(uint256[] memory _ids, address _account, uint256 _gasLimit) external payable;

    /**
     * @notice Unlocks Series 2 tokens for the caller.
     * @param _ids Array of token IDs to unlock.
     * @param _gasLimit Gas limit for the transaction.
     */
    function unlockSeries2Tokens(uint256[] memory _ids, uint256 _gasLimit) external payable;

    /**
     * @notice Sets the address of the zkSync bridge.
     * @param _zkSyncBridge Address of the zkSync bridge.
     */
    function setZkSyncBridge(address _zkSyncBridge) external;

    /**
     * @notice Sets the address of the zkSync mirror for Series 1 NFTs.
     * @param _zkSyncMirror Address of the zkSync mirror.
     */
    function setZkSyncGenesisNFT1Mirror(address _zkSyncMirror) external;

    /**
     * @notice Sets the address of the zkSync mirror for Series 2 NFTs.
     * @param _zkSyncMirror Address of the zkSync mirror.
     */
    function setZkSyncGenesisNFT2Mirror(address _zkSyncMirror) external;

    /**
     * @notice Sets the gas limit for zkSync public data transactions.
     * @param _zkSyncGasPerPubdataLimit Gas limit for zkSync public data transactions.
     */
    function setZkSyncGasPerPubdataLimit(uint256 _zkSyncGasPerPubdataLimit) external;

    /**
     * @notice Returns the address of the Series 1 NFT contract.
     * @return Address of the Series 1 NFT contract.
     */
    function series1Nft() external view returns (address);

    /**
     * @notice Returns the address of the Series 2 NFT contract.
     * @return Address of the Series 2 NFT contract.
     */
    function series2Nft() external view returns (address);

    /**
     * @notice Returns the address of the zkSync bridge.
     * @return Address of the zkSync bridge.
     */
    function zkSyncBridge() external view returns (address);

    /**
     * @notice Returns the address of the zkSync mirror for Series 1 NFTs.
     * @return Address of the zkSync mirror.
     */
    function zkSyncGenesisNFT1Mirror() external view returns (address);

    /**
     * @notice Returns the address of the zkSync mirror for Series 2 NFTs.
     * @return Address of the zkSync mirror.
     */
    function zkSyncGenesisNFT2Mirror() external view returns (address);

    /**
     * @notice Returns the gas limit for zkSync public data transactions.
     * @return Gas limit for zkSync public data transactions.
     */
    function zkSyncGasPerPubdataLimit() external view returns (uint256);

    /**
     * @notice Returns an array of locked Series 1 tokens for a given account.
     * @param _account Address of the account.
     * @return Array of locked Series 1 token IDs.
     */
    function series1LockedTokens(address _account) external view returns (uint256[] memory);

    /**
     * @notice Returns an array of locked Series 2 tokens for a given account.
     * @param _account Address of the account.
     * @return Array of locked Series 2 token IDs.
     */
    function series2LockedTokens(address _account) external view returns (uint256[] memory);

    /**
     * @notice Returns the owner of a locked Series 1 token.
     * @param _tokenId Token ID.
     * @return Address of the owner.
     */
    function series1LockedTokenOwner(uint256 _tokenId) external view returns (address);

    /**
     * @notice Returns the owner of a locked Series 2 token.
     * @param _tokenId Token ID.
     * @return Address of the owner.
     */
    function series2LockedTokenOwner(uint256 _tokenId) external view returns (address);
}
