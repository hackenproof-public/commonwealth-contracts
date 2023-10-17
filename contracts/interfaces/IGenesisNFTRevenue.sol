// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title IProject interface
 */
interface IGenesisNFTRevenue {
    /**
     * @notice Claim revenue part owed to Genesis NFT
     * @param amount amount of tokens transferred to project
     */
    function claimRevenue(uint256 amount) external;

    function availableRevenue(address beneficiary) external view returns (uint256);
}
