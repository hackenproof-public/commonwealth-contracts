// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ERC165Upgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {IERC20Upgradeable, SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IProject} from "./interfaces/IProject.sol";
import {ISwapper} from "./interfaces/ISwapper.sol";
import {IVesting} from "./interfaces/IVesting.sol";
import {IInvestmentFund} from "./interfaces/IInvestmentFund.sol";
import {_transferFrom} from "./libraries/Utils.sol";
import {LibProject} from "./libraries/LibProject.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

error Project__TokenZeroAddress();
error Project__InvestmentFundZeroAddress();
error Project__DexSwapperZeroAddress();
error Project__VestingZeroAddress();
error Project__AmountLessOrEqualZero();
error Project__AmountExceedAvailableFunds();
error Project__NotInvestmentFund();

/**
 * @title Project contract
 * @dev Holds tokens deployed by system for project and contract defining project tokens vesting schedule
 */
contract Project is IProject, OwnablePausable, ERC165Upgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @notice Project name
     */
    string public name;

    /**
     * @notice ERC-20 contract address of token deployed by investment fund
     */
    address public token;

    /**
     * @notice Project status
     */
    bytes32 public status;

    /**
     * @notice Investment Fund address
     */
    address public investmentFund;

    /**
     * @notice Vesting contract address
     */
    IVesting public vesting;

    /**
     * @notice Number of tokens allocated to project
     */
    uint256 public fundsAllocation;

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
    function initialize(
        string memory name_,
        address owner_,
        address token_,
        address swapper_,
        address investmentFund_,
        uint256 fundsAllocation_
    ) public initializer {
        if (token_ == address(0)) revert Project__TokenZeroAddress();
        if (investmentFund_ == address(0)) revert Project__InvestmentFundZeroAddress();
        if (swapper_ == address(0)) revert Project__DexSwapperZeroAddress();
        __Context_init();
        __OwnablePausable_init(owner_);
        __ReentrancyGuard_init();
        fundsAllocation = fundsAllocation_;
        token = token_;
        investmentFund = investmentFund_;
        name = name_;
        status = LibProject.STATUS_ADDED;
        swapper = ISwapper(swapper_);
    }

    /**
     * @inheritdoc IProject
     */
    function setVesting(address vesting_) external onlyOwner {
        if (vesting_ == address(0)) revert Project__VestingZeroAddress();

        address vestingAddress = address(vesting);
        vesting = IVesting(vesting_);

        emit VestingContractChanged(_msgSender(), vestingAddress, vesting_);
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
    function sellVestedToInvestmentFund(
        uint256 _amount,
        uint24 _fee,
        uint160 _sqrtPriceLimitX96,
        uint256 _amountOutMinimum
    ) external onlyOwner {
        if (_amount <= 0) revert Project__AmountLessOrEqualZero();
        if (address(vesting) == address(0)) revert Project__VestingZeroAddress();

        vesting.release(_amount);

        address inputToken = vesting.getVestedToken();
        address outputToken = IInvestmentFund(investmentFund).getDetails().currency;

        IERC20Upgradeable(inputToken).safeIncreaseAllowance(address(swapper), _amount);
        uint256 amountOut = swapper.swap(_amount, inputToken, outputToken, _fee, _amountOutMinimum, _sqrtPriceLimitX96);

        IERC20Upgradeable(outputToken).safeIncreaseAllowance(address(investmentFund), amountOut);
        IInvestmentFund(investmentFund).provideProfit(amountOut);
    }

    /**
     * @inheritdoc IProject
     */
    function deployFunds(uint256 amount) external nonReentrant {
        if (amount <= 0) revert Project__AmountLessOrEqualZero();
        if (amount > fundsAllocation - fundsDeployed) revert Project__AmountExceedAvailableFunds();
        if (_msgSender() != investmentFund) revert Project__NotInvestmentFund();
        fundsDeployed += amount;
        status = LibProject.STATUS_DEPLOYED;

        _transferFrom(token, _msgSender(), address(this), amount);
    }

    /**
     * @inheritdoc IProject
     */
    function getFundsAllocation() external view returns (uint256) {
        return fundsAllocation;
    }

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IProject).interfaceId || super.supportsInterface(interfaceId);
    }

    uint256[45] private __gap;
}
