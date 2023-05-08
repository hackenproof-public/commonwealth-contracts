// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165, IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IProject} from "./interfaces/IProject.sol";
import {ISwapper} from "./interfaces/ISwapper.sol";
import {IVesting} from "./interfaces/IVesting.sol";
import {IInvestmentFund} from "./interfaces/IInvestmentFund.sol";
import {LibProject} from "./libraries/LibProject.sol";

/**
 * @title Project contract
 * @dev Holds tokens deployed by system for project and contract defining project tokens vesting schedule
 */
contract Project is IProject, ERC165, Ownable {
    using SafeERC20 for IERC20;

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

    /**
     * @notice Initializes the contract
     * @param name_ Investment fund name
     * @param owner_ Address with admin rights for project
     */
    constructor(string memory name_, address owner_, address swapper_) {
        require(owner_ != address(0), "Owner is zero address");

        name = name_;
        status = LibProject.STATUS_ADDED;
        transferOwnership(owner_);
        swapper = ISwapper(swapper_);
    }

    /**
     * @inheritdoc IProject
     */
    function setVesting(address vesting_) external onlyOwner {
        require(vesting_ != address(0), "Vesting is zero address");

        emit VestingContractChanged(msg.sender, address(vesting), vesting_);
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

        IERC20(sourceToken).safeApprove(address(swapper), amount);
        uint256 amountOut = swapper.swap(amount, sourceToken, targetToken);

        IERC20(targetToken).safeTransfer(investmentFund, amountOut);
    }

    function deployFunds(uint256 amount) external {
        // TODO implement funds deployment
        fundsDeployed += amount;
        status = LibProject.STATUS_DEPLOYED;
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IProject).interfaceId || super.supportsInterface(interfaceId);
    }
}
