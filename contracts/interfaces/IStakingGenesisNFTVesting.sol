// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title Interface for Staking Genesis NFT Vesting
 * @dev This interface defines functions and structures for managing vesting of rewards for Staking Genesis NFTs.
 */
interface IStakingGenesisNFTVesting {
    /**
     * @dev Struct for storing rewards information.
     */
    struct Rewards {
        address account; // Address of the account receiving rewards
        uint256 series1Rewards; // Amount of Series 1 rewards allocated to the account
        uint256 series2Rewards; // Amount of Series 2 rewards allocated to the account
    }

    /**
     * @dev Releases vested rewards to the caller.
     */
    function release() external;

    /**
     * @dev Sets rewards for multiple accounts.
     * @param _rewards Array of Rewards structs containing rewards information for multiple accounts.
     */
    function setRewards(Rewards[] memory _rewards) external;

    /**
     * @dev Returns the amount of rewards that can be released for a given account.
     * @param _account Address of the account.
     * @return Amount of rewards that can be released.
     */
    function releaseableAmount(address _account) external view returns (uint256);

    /**
     * @dev Returns the address of the WLTH token.
     * @return Address of the WLTH token contract.
     */
    function wlth() external view returns (address);

    /**
     * @dev Returns the allocation amount for rewards.
     * @return Allocation amount for rewards.
     */
    function allocation() external view returns (uint256);

    /**
     * @dev Returns the timestamp when reward distribution starts.
     * @return Timestamp when reward distribution starts.
     */
    function distributionStartTimestamp() external view returns (uint256);

    /**
     * @dev Returns the amount of released tokens.
     * @return Amount of released tokens.
     */
    function releasedAmount() external view returns (uint256);

    /**
     * @dev Returns the total amount of rewards allocated.
     * @return Total amount of rewards allocated.
     */
    function totalRewards() external view returns (uint256);

    /**
     * @dev Checks whether the specified account has claimed rewards.
     * @param _account Address of the account.
     * @return True if the account has claimed rewards, false otherwise.
     */
    function userClaimed(address _account) external view returns (bool);

    /**
     * @dev Returns the amount of Series 1 rewards allocated to the specified account.
     * @param _account Address of the account.
     * @return Amount of Series 1 rewards allocated.
     */
    function series1Rewards(address _account) external view returns (uint256);

    /**
     * @dev Returns the amount of Series 2 rewards allocated to the specified account.
     * @param _account Address of the account.
     * @return Amount of Series 2 rewards allocated.
     */
    function series2Rewards(address _account) external view returns (uint256);
}
