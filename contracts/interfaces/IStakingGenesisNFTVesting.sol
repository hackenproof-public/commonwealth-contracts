// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title Interface for Staking Genesis NFT Vesting
 * @notice This interface defines functions and structures for managing vesting of rewards for Staking Genesis NFTs.
 */
interface IStakingGenesisNFTVesting {
    /**
     * @notice Struct for storing rewards information.
     */
    struct Rewards {
        address account; // Address of the account receiving rewards
        uint256 series1Rewards; // Amount of Series 1 rewards allocated to the account
        uint256 series2Rewards; // Amount of Series 2 rewards allocated to the account
    }

    /**
     * @notice Releases vested rewards to the caller.
     */
    function release() external;

    /**
     * @notice Sets rewards for multiple accounts.
     * @param _rewards Array of Rewards structs containing rewards information for multiple accounts.
     */
    function setRewards(Rewards[] memory _rewards) external;

    /**
     * @notice Sets the wallet address for which access is lost.
     * @param _wallet Address of the wallet to receive lost tokens.
     */
    function setLostWallet(address _wallet) external;

    /**
     * @notice Resets the wallet address which was set as lost.
     * @param _wallet Address of the wallet to reset.
     */
    function resetLostWallet(address _wallet) external;

    /**
     * @notice Allows for emergency withdrawal of tokens to another address.
     * @param _from Address from which tokens will be withdrawn.
     * @param _to Address to which tokens will be transferred.
     */
    function emergencyWithdraw(address _from, address _to) external;

    /**
     * @notice Returns the amount of rewards that can be released for a given account.
     * @param _account Address of the account.
     * @return Amount of rewards that can be released.
     */
    function releaseableAmount(address _account) external view returns (uint256);

    /**
     * @notice Returns the address of the WLTH token.
     * @return Address of the WLTH token contract.
     */
    function wlth() external view returns (address);

    /**
     * @notice Returns the allocation amount for rewards.
     * @return Allocation amount for rewards.
     */
    function allocation() external view returns (uint256);

    /**
     * @notice Returns the timestamp when reward distribution starts.
     * @return Timestamp when reward distribution starts.
     */
    function distributionStartTimestamp() external view returns (uint256);

    /**
     * @notice Returns the amount of released tokens.
     * @return Amount of released tokens.
     */
    function releasedAmount() external view returns (uint256);

    /**
     * @notice Returns the total amount of rewards allocated.
     * @return Total amount of rewards allocated.
     */
    function totalRewards() external view returns (uint256);

    /**
     * @notice Checks whether the specified account has claimed rewards.
     * @param _account Address of the account.
     * @return True if the account has claimed rewards, false otherwise.
     */
    function userClaimed(address _account) external view returns (bool);

    /**
     * @notice Returns the amount of Series 1 rewards allocated to the specified account.
     * @param _account Address of the account.
     * @return Amount of Series 1 rewards allocated.
     */
    function series1Rewards(address _account) external view returns (uint256);

    /**
     * @notice Returns the amount of Series 2 rewards allocated to the specified account.
     * @param _account Address of the account.
     * @return Amount of Series 2 rewards allocated.
     */
    function series2Rewards(address _account) external view returns (uint256);

    /**
     * @notice Checks if the specified wallet address was set as lost.
     * @param _wallet Address of the wallet to check.
     * @return True if the wallet address was set as lost, false otherwise.
     */
    function lostWallet(address _wallet) external view returns (bool);
}
