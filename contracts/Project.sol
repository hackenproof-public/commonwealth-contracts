// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC165Upgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {IERC20Upgradeable, SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IProject} from "./interfaces/IProject.sol";
import {ISwapper} from "./interfaces/ISwapper.sol";
import {IVesting} from "./interfaces/IVesting.sol";
import {IInvestmentFund} from "./interfaces/IInvestmentFund.sol";
import {LibProject} from "./libraries/LibProject.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

/**
 * @title Project contract
 * @dev Holds tokens deployed by system for project and contract defining project tokens vesting schedule
 */
contract Project is IProject, OwnablePausable, ERC165Upgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @notice Project name
     */
    string public name;

    /**
     * @notice Project status
     */
    bytes32 public status;

    /**
     * @notice Vesting contract address
     */
    IVesting public vesting;

    /**
     * @notice Number of tokens deployed to project
     */
    uint256 public fundsDeployed;

    /**
     * @notice DeFi token swapper
     */
    ISwapper public swapper;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param name_ Investment fund name
     * @param owner_ Address with admin rights for project
     * @param swapper_ Address of contract for project tokens swap
     */
    function initialize(string memory name_, address owner_, address swapper_) public initializer {
        __Context_init();
        __OwnablePausable_init(owner_);

        name = name_;
        status = LibProject.STATUS_ADDED;
        swapper = ISwapper(swapper_);
    }

    /**
     * @inheritdoc IProject
     */
    function setVesting(address vesting_) external onlyOwner {
        require(vesting_ != address(0), "Vesting is zero address");

        emit VestingContractChanged(_msgSender(), address(vesting), vesting_);
        vesting = IVesting(vesting_);
    }

    /**
     * @inheritdoc IProject
     */
    function getDetails() external view returns (ProjectDetails memory) {
        return ProjectDetails(name, status, address(vesting));
    }

    /**
     * @inheritdoc IProject
     */
    function sellVestedToInvestmentFund(uint256 amount, address investmentFund) external onlyOwner {
        require(amount > 0, "Amount has to be above zero");

        vesting.release(amount);

        address sourceToken = vesting.getVestedToken();
        address targetToken = IInvestmentFund(investmentFund).getDetails().currency;

        IERC20Upgradeable(sourceToken).safeApprove(address(swapper), amount);
        uint256 amountOut = swapper.swap(amount, sourceToken, targetToken);

        IERC20Upgradeable(targetToken).safeApprove(address(investmentFund), amountOut);
        IInvestmentFund(investmentFund).provideProfit(amountOut);
    }

    function deployFunds(uint256 amount) external {
        // TODO implement funds deployment
        fundsDeployed += amount;
        status = LibProject.STATUS_DEPLOYED;
    }

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IProject).interfaceId || super.supportsInterface(interfaceId);
    }

    uint256[45] private __gap;
}
