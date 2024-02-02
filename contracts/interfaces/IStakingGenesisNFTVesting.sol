// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IStakingGenesisNFTVesting {
    struct Rewards {
        address account;
        uint256 series1Rewards;
        uint256 series2Rewards;
    }

    function release() external;

    function setRewards(Rewards[] memory _rewards) external;

    function emergencyWithdraw(address _account) external;

    function releaseableAmount(address _account) external view returns (uint256);

    function wlth() external view returns (address);

    function allocation() external view returns (uint256);

    function distributionStartTimestamp() external view returns (uint256);

    function releasedAmount() external view returns (uint256);

    function totalRewards() external view returns (uint256);

    function userClaimed(address _account) external view returns (bool);

    function series1Rewards(address _account) external view returns (uint256);

    function series2Rewards(address _account) external view returns (uint256);
}
