// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import {IWlth} from "./interfaces/IWlth.sol";
import {IWlthFund} from "./interfaces/IWlthFund.sol";
import {_transferFrom} from "./libraries/Utils.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

error WlthFund__InvalidProposal();
error WlthFund__ProposalAlreadyExist();
error WlthFund__Top50StakersEntityAlreadyExist();
error WlthFund__WlthZeroAddress();
error WlthFund__OwnerZeroAddress();
error WlthFund__UsdcZeroAddress();
error WlthFund__InvesteeZeroAddress();
error WlthFund__SecondarySalesWalletZeroAddress();
error WlthFund__InvesteeAlreadyFunded();
error WlthFund__NotWriterOrOwner();
error WlthFund__WriterZeroAddress();

contract WlthFund is OwnablePausable, IWlthFund {
    /// @notice WLTH ERC-20 contract address
    address private s_wlth;

    /// @notice USDC ERC-20 contract address
    address private s_usdc;

    /// @notice Secondary Sales Wallet address
    address private s_secondarySalesWallet;

    /// @notice Address allowed to do write and transfer operations
    address private s_writer;

    /// @notice proposal data hash
    mapping(uint256 => bytes32) private s_proposals;

    /// @notice proposal data hash
    mapping(uint256 => bool) private s_proposalsFunded;

    /// @notice Address of Investee.
    mapping(uint256 => bytes32[50]) private s_top50stakers;

    modifier onlyWriterOrOwner() {
        if(msg.sender != s_writer && msg.sender != owner()) revert WlthFund__NotWriterOrOwner();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes contract
     * @param _owner he address of the Timelock
     * @param _wlth The initial voting period
     * @param _usdc The initial voting period
     * @param _secondarySalesWallet The initial voting period
     * @param _writer The initial voting period
     */
    function initialize(
        address _owner,
        address _wlth,
        address _usdc,
        address _secondarySalesWallet,
        address _writer
    ) public initializer {
        if (_owner == address(0)) revert WlthFund__OwnerZeroAddress();
        if (_wlth == address(0)) revert WlthFund__WlthZeroAddress();
        if (_usdc == address(0)) revert WlthFund__UsdcZeroAddress();
        if (_secondarySalesWallet == address(0)) revert WlthFund__SecondarySalesWalletZeroAddress();
        if (_writer == address(0)) revert WlthFund__WriterZeroAddress();

        s_wlth = _wlth;
        s_usdc = _usdc;
        s_secondarySalesWallet = _secondarySalesWallet;
        s_writer = _writer;

        __OwnablePausable_init(_owner);
    }

    /**
     * @inheritdoc IWlthFund
     */
    function fundInvestee(
        uint256 _proposalId,
        address _investee,
        uint256 _fundAmount,
        uint256 _burnAmount
    ) external onlyWriterOrOwner {
        if (_investee == address(0)) revert WlthFund__InvesteeZeroAddress();
        if (s_proposalsFunded[_proposalId]) revert WlthFund__InvesteeAlreadyFunded();
        if (s_proposals[_proposalId] == bytes32(0)) revert WlthFund__InvalidProposal();

        s_proposalsFunded[_proposalId] = true;

        emit InvesteeFunded(_proposalId, _investee, _fundAmount, _burnAmount);

        _transferFrom(s_wlth, s_secondarySalesWallet, address(this), (_burnAmount * 99) / 100);
        IWlth(s_wlth).burn((_burnAmount * 99) / 100);
        _transferFrom(s_usdc, s_secondarySalesWallet, _investee, _fundAmount);
    }

    /**
     * @inheritdoc IWlthFund
     */
    function putTop50Stakers(uint256 _id, bytes32[50] calldata _stakers) external onlyWriterOrOwner {
        if (s_top50stakers[_id][0] != 0) revert WlthFund__Top50StakersEntityAlreadyExist();
        s_top50stakers[_id] = _stakers;

        emit Top50StakersStored(_id, _stakers);
    }

    /**
     * @inheritdoc IWlthFund
     */
    function putProposalHash(uint256 _proposalId, bytes32 _keccakHash) external onlyWriterOrOwner {
        if (s_proposals[_proposalId] != bytes32(0)) revert WlthFund__ProposalAlreadyExist();
        s_proposals[_proposalId] = _keccakHash;

        emit ProposalHashStored(_proposalId, _keccakHash);
    }

    /**
     * @inheritdoc IWlthFund
     */
    function setWriter(address _newWriter) external onlyOwner {
        if (_newWriter == address(0)) revert WlthFund__WriterZeroAddress();
        address oldWriter = s_writer;
        s_writer = _newWriter;

        emit NewWriterSet(oldWriter, _newWriter);
    }

    /**
     * @inheritdoc IWlthFund
     */
    function getTop50Stakers(uint256 _id) external view returns (bytes32[50] memory) {
        bytes32[50] memory stakers = s_top50stakers[_id];
        return stakers;
    }

    /**
     * @inheritdoc IWlthFund
     */
    function getProposalHash(uint256 _proposalId) external view returns (bytes32) {
        return s_proposals[_proposalId];
    }

    /**
     * @inheritdoc IWlthFund
     */
    function wlth() external view returns (address) {
        return s_wlth;
    }

    /**
     * @inheritdoc IWlthFund
     */
    function usdc() external view returns (address) {
        return s_usdc;
    }

    /**
     * @inheritdoc IWlthFund
     */
    function secondarySalesWallet() external view returns (address) {
        return s_secondarySalesWallet;
    }

    /**
     * @inheritdoc IWlthFund
     */
    function writer() external view returns (address) {
        return s_writer;
    }
}