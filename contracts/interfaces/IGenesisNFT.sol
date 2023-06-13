// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IGenesisNFT {
    /**
     * @notice Returns Genesis NFT series number
     * @return Genesis NFT series number
     */
    function getSeries() external returns (uint256);
}
