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
    event ProposalExecuted(uint256 indexed proposalId, address investee, uint256 indexed fundAmount, uint256 indexed burnAmount);

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
    function executeProposal(uint256 proposalId, address investee, uint256 fundAmount, uint256 burnAmount) external;

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
}
