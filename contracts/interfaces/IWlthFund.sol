// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IWlthFund {
    /**
     * @notice Emitted when new minter account is added to contract
     * @param proposalId Address of new minter
     * @param investee asd
     * @param fundAmount Address of new minter
     * @param burnAmount Address of new minter
     */
    event InvesteeFunded(
        uint256 indexed proposalId,
        address investee,
        uint256 indexed fundAmount,
        uint256 indexed burnAmount
    );

    /**
     * @notice Emitted when new minter account is added to contract
     * @param id Address of new minter
     * @param stakers asd
     */
    event Top50StakersStored(uint256 indexed id, bytes32[50] indexed stakers);

    /**
     * @notice Emitted when new minter account is added to contract
     * @param proposalId Address of new minter
     * @param keccakHash asd
     */
    event ProposalHashStored(uint256 indexed proposalId, bytes32 indexed keccakHash);

    /**
     * @notice Burns the amount of tokens
     * @param proposalId Amount to be burned
     * @param keccakHash Amount to be burned
     */
    function putProposalHash(uint256 proposalId, bytes32 keccakHash) external;

    /**
     * @notice Burns the amount of tokens
     * @param id to be burned
     * @param stakers top 50 stakers list
     */
    function putTop50Stakers(uint256 id, bytes32[50] calldata stakers) external;

    /**
     * @notice Returns the amount of tokens burned
     * @param proposalId to be burned
     * @param investee top 50 stakers list
     * @param fundAmount to be burned
     * @param burnAmount top 50 stakers list
     */
    function fundInvestee(uint256 proposalId, address investee, uint256 fundAmount, uint256 burnAmount) external;

    /**
     * @notice Burns the amount of tokens
     * @param id to be burned
     */
    function getTop50Stakers(uint256 id) external view returns (bytes32[50] memory);

    /**
     * @notice Burns the amount of tokens
     * @param proposalId to be burned
     */
    function getProposalHash(uint256 proposalId) external view returns (bytes32);

    /**
     * @notice Returns WLTH contract address
     */
    function wlth() external view returns (address);

    /**
     * @notice Returns USDC contract address
     */
    function usdc() external view returns (address);

    /**
     * @notice Returns secondary sales wallet address;
     */
    function secondarySalesWallet() external view returns (address);
}
