// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

import {IStakingGenesisNFT} from "./interfaces/IStakingGenesisNFT.sol";
import {ClaimableVesting} from "./ClaimableVesting.sol";
import {IGenesisNFT} from "./interfaces/IGenesisNFT.sol";

contract GenesisNFTvesting is ClaimableVesting {
    uint256 public constant SEC_IN_MONTH = 2_678_400;
    uint256 public constant SERIES_ONE_REWARD = 44_000;
    uint256 public constant SERIES_TWO_REWARD = 6_444;
    uint256 public constant MONTHS_TO_FULL_VEST = 24;

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

    function claimableAmount(address claimer) public view override returns (uint256) {
        uint256 timeElapsed = block.timestamp - vestingStartTimestamp;
        uint256 monthsElapsed = MathUpgradeable.min(timeElapsed / SEC_IN_MONTH, MONTHS_TO_FULL_VEST);
        uint256 series = IGenesisNFT(claimDataSource).getSeries();
        uint256 ownedTokens = IERC721Upgradeable(claimDataSource).balanceOf(claimer);

        require(series == 1 || series == 2, "Unknown Genesis NFT token series");
        uint256 reward;

        if (series == 1) {
            reward = ownedTokens * MathUpgradeable.mulDiv(monthsElapsed, SERIES_ONE_REWARD, MONTHS_TO_FULL_VEST);
        } else if (series == 2) {
            reward = ownedTokens * MathUpgradeable.mulDiv(monthsElapsed, SERIES_TWO_REWARD, MONTHS_TO_FULL_VEST);
        }

        return reward;
    }
}
