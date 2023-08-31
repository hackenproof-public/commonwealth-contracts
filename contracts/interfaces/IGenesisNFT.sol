// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IGenesisNFT {
    /**
     * @notice Emitted when zkSync GenesisNFTmirror notification about moving a token is sent
     * @param tokenId id of a transferred token
     * @param to address of a transfer
     * @param txHash canonical transaction hash of the notification
     */
    event TokenMoved(uint256 indexed tokenId, address indexed to, bytes32 indexed txHash);

    /**
     * @notice Returns Genesis NFT series number
     * @return Genesis NFT series number
     */
    function getSeries() external view returns (uint256);
}
