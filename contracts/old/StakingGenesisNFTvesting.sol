// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IStakingGenesisNFT} from "../interfaces/IStakingGenesisNFT.sol";
import {ClaimableVesting} from "../ClaimableVesting.sol";

contract StakingGenesisNFTvesting is ClaimableVesting {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address claimableCurrency_,
        address claimDataSource_,
        uint256 vestingStartTimestamp_
    ) public override initializer {
        super.initialize(owner_, claimableCurrency_, claimDataSource_, vestingStartTimestamp_);
    }

    // TODO: handle that 1 WLTH = 10e18 tokens, not just 1
    function claimableAmount(address claimer) public view override returns (uint256) {
        return
            ((
                (IStakingGenesisNFT(claimDataSource).getRewardSmall(claimer) +
                    IStakingGenesisNFT(claimDataSource).getRewardLarge(claimer))
            ) * 10) ^ 18;
    }
}
