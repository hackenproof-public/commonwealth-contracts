// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IWlthFund {
    /**
     * @notice Emitted when Investee is funded
     * @param proposalId id of the proposal
     * @param investee funded investee wallet address
     * @param fundAmount amount sent to investee
     * @param burnAmount amount burned
     */
    event InvesteeFunded(
        uint256 indexed proposalId,
        address investee,
        uint256 indexed fundAmount,
        uint256 indexed burnAmount
    );

    /**
     * @notice Emitted when top50stahers list is stored
     * @param id stakers list id
     * @param stakers stakers list
     */
    event Top50StakersStored(uint256 indexed id, bytes32[50] indexed stakers);

    /**
     * @notice Emitted when new minter account is added to contract
     * @param proposalId id of the proposal
     * @param keccakHash hashed proposal data
     */
    event ProposalHashStored(uint256 indexed proposalId, bytes32 indexed keccakHash);

    /**
     * @notice Emitted when new writer account is set
     * @param oldWriter Address of old writer
     * @param newWriter Address of new writer
     */
    event NewWriterSet(address oldWriter, address newWriter);

    /**
     * @notice put proposal hash
     * @param proposalId id of the proposal
     * @param keccakHash hashed proposal data
     */
    function putProposalHash(uint256 proposalId, bytes32 keccakHash) external;

    /**
     * @notice put top 50 stakers list
     * @param id if of the top 50 stakers list
     * @param stakers top 50 stakers list
     */
    function putTop50Stakers(uint256 id, bytes32[50] calldata stakers) external;

    /**
     * @notice send tokens from Secondary Sales Wallet to Investee and burn tokens
     * @param proposalId id of the proposal
     * @param investee address to be funded
     * @param fundAmount to be funded
     * @param burnAmount to be burned
     */
    function fundInvestee(uint256 proposalId, address investee, uint256 fundAmount, uint256 burnAmount) external;

    /**
     * @notice Set new writer address
     * @param _newWriter new writer address
     */
    function setWriter(address _newWriter) external;

    /**
     * @notice Returns top 50 stakers list
     * @param id to be burned
     */
    function getTop50Stakers(uint256 id) external view returns (bytes32[50] memory);

    /**
     * @notice Returns proposal hash
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

    /**
     * @notice Returns writer address
     */
    function writer() external view returns (address);
}