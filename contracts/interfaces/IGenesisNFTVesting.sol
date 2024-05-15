// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title IGenesisNFTVesting
 * @notice An interface for managing the vesting of Genesis NFTs and releasing rewards over time.
 */
interface IGenesisNFTVesting {
    /**
     * @notice Event emitted when rewards are released.
     */
    event Released(address indexed beneficiary, uint256 indexed amount, uint256 indexed tokenId);

    /**
     * @notice Event emitted when a vesting start timestamp was set after (not during) deployment.
     */
    event VestingStartTimestampSet(uint256 indexed timestamp);

    /**
     * @notice Event emitted when a token is marked as lost.
     */
    event LostTokenSet(uint256 indexed tokenId, uint256 indexed series);

    /**
     * @notice Event emitted when a token is unmarked as lost.
     */
    event LostTokenReseted(uint256 indexed tokenId, uint256 indexed series);

    /**
     * @notice Event emitted when bonus was setted up for certain NFTs.
     * @param _tokenIds Array of Series 1 NFT token IDs.
     * @param _flag describes if bonus was activated or deactivated
     */
    event BonusSetted(bool _flag, uint256[] indexed _tokenIds);

    /**
     * @notice Event emitted when an emergency withdrawal is performed.
     */
    event EmergencyWithdrawalPerformed(
        uint256 indexed series,
        uint256 indexed tokenId,
        address indexed to,
        uint256 amount
    );

    /**
     * @notice Releases all available vested rewards for a beneficiary's NFTs.
     * @param _series1TokenIds Array of Series 1 NFT token IDs.
     * @param _series2TokenIds Array of Series 2 NFT token IDs.
     * @param _beneficiary Address of the beneficiary.
     */
    function releaseAllAvailable(
        uint256[] memory _series1TokenIds,
        uint256[] memory _series2TokenIds,
        address _beneficiary,
        bool gamified
    ) external;

    /**
     * @notice Sets up bonus for Series 1 NFTs.
     * @param _series1tokenIds Array of Series 1 NFT token IDs.
     * @param _flag defined if bonus should be given or revoked for NFTs defined in the array
     */
    function setupBonus(uint256[] memory _series1tokenIds, bool _flag) external;

    /**
     * @notice Returns the unvested amount per NFT based on the given parameters.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @return The unvested amount per NFT.
     */
    function unvestedAmountPerNFT(bool _series1, uint256 _tokenId) external view returns (uint256);

    /**
     * @notice Returns the total releasable amount for a beneficiary's NFTs.
     * @param _series1TokenIds Array of Series 1 NFT token IDs.
     * @param _series2TokenIds Array of Series 2 NFT token IDs.
     * @param _beneficiary Address of the beneficiary.
     * @return The total releasable amount.
     */
    function releasableAmount(
        uint256[] memory _series1TokenIds,
        uint256[] memory _series2TokenIds,
        address _beneficiary,
        bool gamified
    ) external view returns (uint256);

    /**
     * @notice Releases vested rewards for a specific NFT.
     * @param _isSeries1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @param _amount The amount to be released.
     * @param _beneficiary Address of the beneficiary.
     */
    function releasePerNFT(
        bool _isSeries1,
        uint256 _tokenId,
        uint256 _amount,
        address _beneficiary,
        bool gamified
    ) external;

    /**
     * @notice Sets the lost status for a specific NFT.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     */
    function setLostToken(bool _series1, uint256 _tokenId) external;

    /**
     * @notice Resets the lost status for a specific NFT.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     */
    function resetLostToken(bool _series1, uint256 _tokenId) external;

    /**
     * @notice Performs emergency withdrawal of rewards for a specific NFT.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @param _to Address to which the rewards will be withdrawn.
     */
    function emergencyWithdraw(bool _series1, uint256 _tokenId, address _to) external;

    /**
     * @notice Sets vesting start timestamp (one-time use)
     * @param _timestamp desired vesting start timestamp
     */
    function setVestingStartTimestamp(uint256 _timestamp) external;

    /**
     * @notice Returns the releasable amount for a specific NFT.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @return The releasable amount per NFT.
     */
    function releasableAmountPerNFT(bool _series1, uint256 _tokenId, bool gamified) external view returns (uint256);

    /**
     * @notice Returns the vested amount for a specific NFT.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @return The vested amount per NFT.
     */
    function vestedAmountPerNFT(bool _series1, uint256 _tokenId) external view returns (uint256);

    /**
     * @notice Returns the address of the contract managing Series 1 Genesis NFTs.
     * @return The address of the Series 1 Genesis NFT contract.
     */
    function genesisNftSeries1Mirror() external view returns (address);

    /**
     * @notice Returns the address of the contract managing Series 2 Genesis NFTs.
     * @return The address of the Series 2 Genesis NFT contract.
     */
    function genesisNftSeries2Mirror() external view returns (address);

    /**
     * @notice Returns the address of the WLTH token contract.
     * @return The address of the WLTH token contract.
     */
    function wlth() external view returns (address);

    /**
     * @notice Returns the duration of the vesting period.
     * @return The duration of the vesting period.
     */
    function duration() external view returns (uint256);

    /**
     * @notice Returns the cadence of releasing rewards.
     * @return The cadence of releasing rewards.
     */
    function cadence() external view returns (uint256);

    /**
     * @notice Returns the timestamp at which the vesting starts.
     * @return The timestamp at which the vesting starts.
     */
    function vestingStartTimestamp() external view returns (uint256);

    /**
     * @notice Returns the total allocation of rewards.
     * @return The total allocation of rewards.
     */
    function allocation() external view returns (uint256);

    /**
     * @notice Returns the total amount of rewards released.
     * @return The total amount of rewards released.
     */
    function released() external view returns (uint256);

    /**
     * @notice Returns the bonus value for a specific NFT.
     * @param _tokenId The token ID of the NFT.
     * @return The bonus value for the NFT.
     */
    function bonusValue(uint256 _tokenId) external view returns (uint256);

    /**
     * @notice Returns the total amount claimed by a Series 1 NFT token ID.
     * @param _tokenId The token ID of the NFT.
     * @return The total amount claimed by the NFT.
     */
    function amountClaimedBySeries1TokenId(uint256 _tokenId) external view returns (uint256);

    /**
     * @notice Returns the total amount claimed by a Series 2 NFT token ID.
     * @param _tokenId The token ID of the NFT.
     * @return The total amount claimed by the NFT.
     */
    function amountClaimedBySeries2TokenId(uint256 _tokenId) external view returns (uint256);

    /**
     * @notice Checks whether a specific NFT is marked as lost.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @return True if the NFT is marked as lost, false otherwise.
     */
    function lostToken(bool _series1, uint256 _tokenId) external view returns (bool);

    /**
     * @notice Checks whether a specific NFT was gamified.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @return True if the NFT was gamified, false otherwise.
     */
    function wasGamified(bool _series1, uint256 _tokenId) external view returns (bool);
}
