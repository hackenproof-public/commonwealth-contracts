// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IStakingGenesisNFT {
    /**
     * @notice Sets timestamp by which staking ends
     * @param finalTimestamp timestamp after which staking ends
     */
    function setFinalTimestamp(uint256 finalTimestamp) external;

    /**
     * @notice Submits token for staking. Requires transfer approval for all the tokens.
     * @param tokenIdsSmall IDs of small (Gen. 2) tokens
     * @param tokenIdsLarge IDs of large (Gen. 1) tokens
     */
    function stake(uint256[] calldata tokenIdsSmall, uint256[] calldata tokenIdsLarge) external;

    /**
     * @notice Retrieves tokens from staking alongside WLTH reward
     * @param tokenIdsSmall IDs of small (Gen. 2) tokens
     * @param tokenIdsLarge IDs of large (Gen. 1) tokens
     */
    function unstake(uint256[] calldata tokenIdsSmall, uint256[] calldata tokenIdsLarge) external;

    /**
     * @notice Calculates current staking reward for small (Gen. 2) tokens
     * @param account address to calculate for
     */
    function getRewardSmall(address account) external view returns (uint256);

    /**
     * @notice Calculates current staking reward for large (Gen. 1) tokens
     * @param account address to calculate for
     */
    function getRewardLarge(address account) external view returns (uint256);

    /**
     * @notice Number of currently staked small tokens
     * @param account address to calculate for
     */
    function getStakedTokensSmall(address account) external view returns (uint256[] memory);

    /**
     * @notice Number of currently staked large tokens
     * @param account address to calculate for
     */
    function getStakedTokensLarge(address account) external view returns (uint256[] memory);
}
