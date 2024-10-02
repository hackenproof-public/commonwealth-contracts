// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UniswapSwapper} from "./UniswapSwapper.sol";
import {Wlth} from "./Wlth.sol";
import {IBuybackAndBurn} from "./interfaces/IBuybackAndBurn.sol";
import {IUniswapWlthPrice} from "./interfaces/IUniswapWlthPrice.sol";
import {BASIS_POINT_DIVISOR} from "./libraries/Constants.sol";

error BuybackAndBurn__OwnerZeroAddress();
error BuybackAndBurn__WlthZeroAddress();
error BuybackAndBurn__UsdcZeroAddress();
error BuybackAndBurn__SwapperZeroAddress();
error BuybackAndBurn__PoolZeroAddress();
error BuybackAndBurn__InvalidBalance();
error BuybackAndBurn__UniswapWlthPriceZeroAddress();
error BuybackAndBurn__InvalidSlippage();

contract BuybackAndBurn is IBuybackAndBurn, AutomationCompatibleInterface, Ownable2StepUpgradeable {
    uint256 private constant ONE_WLTH_TOKEN = 1e18;

    /**
     * @dev UniswapSwapper contract
     */
    UniswapSwapper private s_swapper;

    /**
     * @dev Wlth contract
     */
    Wlth private s_wlth;

    /**
     * @dev USDC contract
     */
    IERC20 private s_usdc;

    /**
     * @dev USDC/WLTH Uniswap V3 pool
     */
    IUniswapV3Pool private s_pool;

    /**
     * @dev Minimum amount of USDC to perform buyback
     */
    uint256 private s_minimumBuyback;

    /**
     * @dev Slippage percentage
     */
    uint256 private s_slippageInBasisPoints;

    /**
     * @dev UniswapWlthPrice contract
     */
    IUniswapWlthPrice private s_uniswapWlthPriceOracle;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param _owner Address of contract owner
     * @param _wlth Address of WLTH token
     * @param _usdc Address of USDC token
     * @param _swapper Address of UniswapSwapper contract
     * @param _pool Address of USDC/WLTH Uniswap V3 pool
     * @param _minimumBuyback Minimum amount of USDC to perform buyback
     * @param _slippageInBasisPoints Slippage percentage
     * @param _uniswapWlthPriceOracle Address of UniswapWlthPrice contract
     */
    function initialize(
        address _owner,
        Wlth _wlth,
        IERC20 _usdc,
        UniswapSwapper _swapper,
        IUniswapV3Pool _pool,
        uint256 _minimumBuyback,
        uint256 _slippageInBasisPoints,
        IUniswapWlthPrice _uniswapWlthPriceOracle
    ) public initializer {
        if (_owner == address(0)) {
            revert BuybackAndBurn__OwnerZeroAddress();
        }
        if (address(_wlth) == address(0)) {
            revert BuybackAndBurn__WlthZeroAddress();
        }
        if (address(_usdc) == address(0)) {
            revert BuybackAndBurn__UsdcZeroAddress();
        }
        if (address(_swapper) == address(0)) {
            revert BuybackAndBurn__SwapperZeroAddress();
        }
        if (address(_pool) == address(0)) {
            revert BuybackAndBurn__PoolZeroAddress();
        }
        if (address(_uniswapWlthPriceOracle) == address(0)) {
            revert BuybackAndBurn__UniswapWlthPriceZeroAddress();
        }
        if (_slippageInBasisPoints > BASIS_POINT_DIVISOR) {
            revert BuybackAndBurn__InvalidSlippage();
        }

        __Ownable2Step_init();
        _transferOwnership(_owner);

        s_wlth = _wlth;
        s_usdc = _usdc;
        s_swapper = _swapper;
        s_pool = _pool;
        s_minimumBuyback = _minimumBuyback;
        s_slippageInBasisPoints = _slippageInBasisPoints;
        s_uniswapWlthPriceOracle = _uniswapWlthPriceOracle;
    }

    /**
     * @inheritdoc AutomationCompatibleInterface
     */
    function performUpkeep(bytes calldata /* performData */) external override {
        IERC20 usdcToken = IERC20(s_usdc);
        uint256 usdcBalance = usdcToken.balanceOf(address(this));

        if (usdcBalance == 0 || usdcBalance < s_minimumBuyback) {
            revert BuybackAndBurn__InvalidBalance();
        }

        UniswapSwapper uniswapSwapper = s_swapper;
        TransferHelper.safeApprove(address(usdcToken), address(uniswapSwapper), usdcBalance);

        (uint160 sqrtPriceX96, , , , , , ) = s_pool.slot0();
        uint160 sqrtPriceLimit = sqrtPriceX96 + ((sqrtPriceX96 * 10) / 100);
        Wlth wlthToken = s_wlth;
        uniswapSwapper.swap(
            usdcBalance,
            address(usdcToken),
            address(wlthToken),
            3000,
            getMinimumAmountOut(usdcBalance),
            sqrtPriceLimit
        );

        uint256 wlthBalance = wlthToken.balanceOf(address(this));
        wlthToken.burn(wlthBalance);

        emit BuybackAndBurnPerformed(wlthBalance, usdcBalance);
    }

    /**
     * @inheritdoc IBuybackAndBurn
     */
    function setMinimumBuyback(uint256 _minimumBuyback) external override onlyOwner {
        s_minimumBuyback = _minimumBuyback;
        emit MinimumBuybackSet(_minimumBuyback);
    }

    function setSlippage(uint256 _slippageInBasisPoints) external override onlyOwner {
        if (_slippageInBasisPoints > BASIS_POINT_DIVISOR) {
            revert BuybackAndBurn__InvalidSlippage();
        }
        s_slippageInBasisPoints = _slippageInBasisPoints;
        emit SlippageSet(_slippageInBasisPoints);
    }

    /**
     * @inheritdoc AutomationCompatibleInterface
     */
    function checkUpkeep(
        bytes calldata /* checkData */
    ) external view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        uint256 usdcBalance = IERC20(s_usdc).balanceOf(address(this));
        upkeepNeeded = usdcBalance != 0 && usdcBalance >= s_minimumBuyback;
    }

    /**
     * @inheritdoc IBuybackAndBurn
     */
    function minimumBuyback() external view override returns (uint256) {
        return s_minimumBuyback;
    }

    /**
     * @inheritdoc IBuybackAndBurn
     */
    function swapper() external view override returns (address) {
        return address(s_swapper);
    }

    /**
     * @inheritdoc IBuybackAndBurn
     */
    function wlth() external view override returns (address) {
        return address(s_wlth);
    }

    /**
     * @inheritdoc IBuybackAndBurn
     */
    function usdc() external view override returns (address) {
        return address(s_usdc);
    }

    /**
     * @inheritdoc IBuybackAndBurn
     */
    function pool() external view override returns (address) {
        return address(s_pool);
    }

    /**
     * @inheritdoc IBuybackAndBurn
     */
    function slippageInBasisPoints() external view override returns (uint256) {
        return s_slippageInBasisPoints;
    }

    /**
     * @inheritdoc IBuybackAndBurn
     */
    function wlthPriceOracle() external view override returns (address) {
        return address(s_uniswapWlthPriceOracle);
    }

    /**
     * @notice Get the minimum amount of WLTH tokens to receive
     * @param _amountIn Amount of USDC to swap
     */
    function getMinimumAmountOut(uint256 _amountIn) private view returns (uint256) {
        uint256 wlthPriceInUsdc = s_uniswapWlthPriceOracle.estimateAmountOut(uint128(ONE_WLTH_TOKEN));
        return
            ((_amountIn * (BASIS_POINT_DIVISOR - s_slippageInBasisPoints)) / wlthPriceInUsdc / BASIS_POINT_DIVISOR) *
            ONE_WLTH_TOKEN;
    }

    uint256[48] private __gap;
}
