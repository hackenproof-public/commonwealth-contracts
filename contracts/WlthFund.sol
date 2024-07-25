// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IWlth} from "./interfaces/IWlth.sol";
import {IWlthFund} from "./interfaces/IWlthFund.sol";
import {_transfer} from "./libraries/Utils.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

error WlthFund__InvalidProposal();
error WlthFund__ProposalAlreadyExist();
error WlthFund__Top0StakersEntityAlreadyExist();
error WlthFund__WlthZeroAddress();
error WlthFund__OwnerZeroAddress();
error WlthFund__UsdcZeroAddress();
error WlthFund__SecondarySalesWalletZeroAddress();

contract WlthFundLedger is ReentrancyGuardUpgradeable, OwnablePausable, IWlthFund {
    /// @notice WLTH ERC-20 contract address
    address private s_wlth;

    /// @notice USDC ERC-20 contract address
    address private s_usdc;

    /// @notice Secondary Sales Wallet address
    address private s_secondarySalesWallet;

    /// @notice proposal data hash
    mapping(uint256 => bytes32) private s_proposals;

    /// @notice Address of Investee.
    mapping(uint256 => bytes32[50]) private s_top50stakers;

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
      */
    function initialize(address _owner, address _wlth, address _usdc, address _secondarySalesWallet) public initializer{
        if (_owner == address(0)) revert WlthFund__OwnerZeroAddress();
        if (_wlth == address(0)) revert WlthFund__WlthZeroAddress();
        if (_usdc == address(0)) revert WlthFund__UsdcZeroAddress();
        if (_secondarySalesWallet == address(0)) revert WlthFund__SecondarySalesWalletZeroAddress();

         s_wlth = _wlth;
         s_usdc = _usdc;
         s_secondarySalesWallet = _secondarySalesWallet;

         __OwnablePausable_init(_owner);
    }

    /**
     * @inheritdoc IWlthFund
     */
    function executeProposal(uint256 _proposalId, address _investee, uint256 _fundAmount, uint256 _burnAmount) external nonReentrant onlyOwner {
        if(s_proposals[_proposalId] == bytes32(0)) revert WlthFund__InvalidProposal();

        emit ProposalExecuted(_proposalId, _investee, _fundAmount, _burnAmount);

        IWlth(s_wlth).burn(_burnAmount*99/100);
        _transfer(s_wlth, s_secondarySalesWallet, _burnAmount/100);
        _transfer(s_usdc, _investee, _fundAmount);
    }

    /**
     * @inheritdoc IWlthFund
     */
    function putTop50Stakers(uint256 _id, bytes32[50] calldata _stakers) external onlyOwner {
        if(s_top50stakers[_id].length != 0) revert WlthFund__Top0StakersEntityAlreadyExist();
        s_top50stakers[_id] = _stakers;
    }

    /**
     * @inheritdoc IWlthFund
     */
    function putProposalHash(uint256 _proposalId, bytes32 _keccakHash) external onlyOwner {
        if(s_proposals[_proposalId] != bytes32(0)) revert WlthFund__ProposalAlreadyExist();
        s_proposals[_proposalId] = _keccakHash;
    }

    /**
     * @inheritdoc IWlthFund
     */
    function getTop50Stakers(uint256 _id) external view returns (bytes32[50] memory) {
        bytes32[50] memory stakers =  s_top50stakers[_id];
        return stakers;
    }

    /**
     * @inheritdoc IWlthFund
     */
    function getProposalHash(uint256 _proposalId) external view returns (bytes32) {
        return s_proposals[_proposalId];
    }
}