// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title IGenesisNFTVesting
 * @notice An interface for managing the vesting of Genesis NFTs and releasing rewards over time.
 */
interface IGenesisNFTVesting {
    /**
     * @notice Releases all available vested rewards for a beneficiary's NFTs.
     * @param _series1TokenIds Array of Series 1 NFT token IDs.
     * @param _series2TokenIds Array of Series 2 NFT token IDs.
     * @param _beneficiary Address of the beneficiary.
     */
    function releaseAllAvailable(
        uint256[] memory _series1TokenIds,
        uint256[] memory _series2TokenIds,
        address _beneficiary
    ) external;

    /**
     * @notice Sets up bonus for Series 1 NFTs.
     * @param _series1tokenIds Array of Series 1 NFT token IDs.
     */
    function setupBonus(uint256[] memory _series1tokenIds) external;

    /**
     * @notice Returns the unvested amount per NFT based on the given parameters.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @param _actualTimestamp The actual timestamp for calculation.
     * @return The unvested amount per NFT.
     */
    function unvestedAmountPerNFT(
        bool _series1,
        uint256 _tokenId,
        uint256 _actualTimestamp
    ) external view returns (uint256);

    /**
     * @notice Returns the total releasable amount for a beneficiary's NFTs.
     * @param _series1TokenIds Array of Series 1 NFT token IDs.
     * @param _series2TokenIds Array of Series 2 NFT token IDs.
     * @param _actualTimestamp The actual timestamp for calculation.
     * @param _beneficiary Address of the beneficiary.
     * @return The total releasable amount.
     */
    function releasableAmount(
        uint256[] memory _series1TokenIds,
        uint256[] memory _series2TokenIds,
        uint256 _actualTimestamp,
        address _beneficiary
    ) external view returns (uint256);

    /**
     * @notice Releases vested rewards for a specific NFT.
     * @param _isSeries1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @param _amount The amount to be released.
     * @param _beneficiary Address of the beneficiary.
     */
    function releasePerNFT(bool _isSeries1, uint256 _tokenId, uint256 _amount, address _beneficiary) external;

    /**
     * @notice Returns the releasable amount for a specific NFT.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @param _actualTimestamp The actual timestamp for calculation.
     * @return The releasable amount per NFT.
     */
    function releasableAmountPerNFT(
        bool _series1,
        uint256 _tokenId,
        uint256 _actualTimestamp
    ) external view returns (uint256);

    /**
     * @notice Returns the vested amount for a specific NFT.
     * @param _series1 Boolean indicating whether the NFT is of Series 1 or not.
     * @param _tokenId The token ID of the NFT.
     * @param _actualTimestamp The actual timestamp for calculation.
     * @return The vested amount per NFT.
     */
    function vestedAmountPerNFT(
        bool _series1,
        uint256 _tokenId,
        uint256 _actualTimestamp
    ) external view returns (uint256);

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
}
