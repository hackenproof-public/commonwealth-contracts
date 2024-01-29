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
     * @dev Locks Series 1 tokens for a given account.
     * @param _ids Array of token IDs to lock.
     * @param _account Address of the account.
     * @param _gasLimit Gas limit for the transaction.
     */
    function lockSeries1Tokens(uint256[] memory _ids, address _account, uint256 _gasLimit) external payable;

    /**
     * @dev Unlocks Series 1 tokens for the caller.
     * @param _ids Array of token IDs to unlock.
     * @param _gasLimit Gas limit for the transaction.
     */
    function unlockSeries1Tokens(uint256[] memory _ids, uint256 _gasLimit) external payable;

    /**
     * @dev Locks Series 2 tokens for a given account.
     * @param _ids Array of token IDs to lock.
     * @param _account Address of the account.
     * @param _gasLimit Gas limit for the transaction.
     */
    function lockSeries2Tokens(uint256[] memory _ids, address _account, uint256 _gasLimit) external payable;

    /**
     * @dev Unlocks Series 2 tokens for the caller.
     * @param _ids Array of token IDs to unlock.
     * @param _gasLimit Gas limit for the transaction.
     */
    function unlockSeries2Tokens(uint256[] memory _ids, uint256 _gasLimit) external payable;

    /**
     * @dev Sets the address of the zkSync bridge.
     * @param _zkSyncBridge Address of the zkSync bridge.
     */
    function setZkSyncBridge(address _zkSyncBridge) external;

    /**
     * @dev Sets the address of the zkSync mirror for Series 1 NFTs.
     * @param _zkSyncMirror Address of the zkSync mirror.
     */
    function setZkSyncGenesisNFT1Mirror(address _zkSyncMirror) external;

    /**
     * @dev Sets the address of the zkSync mirror for Series 2 NFTs.
     * @param _zkSyncMirror Address of the zkSync mirror.
     */
    function setZkSyncGenesisNFT2Mirror(address _zkSyncMirror) external;

    /**
     * @dev Sets the gas limit for zkSync public data transactions.
     * @param _zkSyncGasPerPubdataLimit Gas limit for zkSync public data transactions.
     */
    function setZkSyncGasPerPubdataLimit(uint256 _zkSyncGasPerPubdataLimit) external;

    /**
     * @dev Returns the address of the Series 1 NFT contract.
     * @return Address of the Series 1 NFT contract.
     */
    function series1Nft() external view returns (address);

    /**
     * @dev Returns the address of the Series 2 NFT contract.
     * @return Address of the Series 2 NFT contract.
     */
    function series2Nft() external view returns (address);

    /**
     * @dev Returns the address of the zkSync bridge.
     * @return Address of the zkSync bridge.
     */
    function zkSyncBridge() external view returns (address);

    /**
     * @dev Returns the address of the zkSync mirror for Series 1 NFTs.
     * @return Address of the zkSync mirror.
     */
    function zkSyncGenesisNFT1Mirror() external view returns (address);

    /**
     * @dev Returns the address of the zkSync mirror for Series 2 NFTs.
     * @return Address of the zkSync mirror.
     */
    function zkSyncGenesisNFT2Mirror() external view returns (address);

    /**
     * @dev Returns the gas limit for zkSync public data transactions.
     * @return Gas limit for zkSync public data transactions.
     */
    function zkSyncGasPerPubdataLimit() external view returns (uint256);

    /**
     * @dev Returns an array of locked Series 1 tokens for a given account.
     * @param _account Address of the account.
     * @return Array of locked Series 1 token IDs.
     */
    function series1LockedTokens(address _account) external view returns (uint256[] memory);

    /**
     * @dev Returns an array of locked Series 2 tokens for a given account.
     * @param _account Address of the account.
     * @return Array of locked Series 2 token IDs.
     */
    function series2LockedTokens(address _account) external view returns (uint256[] memory);

    /**
     * @dev Returns the owner of a locked Series 1 token.
     * @param _tokenId Token ID.
     * @return Address of the owner.
     */
    function series1LockedTokenOwner(uint256 _tokenId) external view returns (address);

    /**
     * @dev Returns the owner of a locked Series 2 token.
     * @param _tokenId Token ID.
     * @return Address of the owner.
     */
    function series2LockedTokenOwner(uint256 _tokenId) external view returns (address);
}
