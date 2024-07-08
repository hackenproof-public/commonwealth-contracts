// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UniswapSwapper} from "./UniswapSwapper.sol";
import {Wlth} from "./Wlth.sol";
import {IBuybackAndBurn} from "./interfaces/IBuybackAndBurn.sol";

error BuybackAndBurn__OwnerZeroAddress();
error BuybackAndBurn__WlthZeroAddress();
error BuybackAndBurn__UsdcZeroAddress();
error BuybackAndBurn__SwapperZeroAddress();
error BuybackAndBurn__PoolZeroAddress();
error BuybackAndBurn__InvalidBalance();

contract BuybackAndBurn is IBuybackAndBurn, AutomationCompatibleInterface, OwnablePausable {
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    /**
     * @dev Initializes the contract
     * @param _owner Address of contract owner
     * @param _wlth Address of WLTH token
     * @param _usdc Address of USDC token
     * @param _swapper Address of UniswapSwapper contract
     * @param _pool Address of USDC/WLTH Uniswap V3 pool
     * @param _minimumBuyback Minimum amount of USDC to perform buyback
     */
    function initialize(
        address _owner,
        Wlth _wlth,
        IERC20 _usdc,
        UniswapSwapper _swapper,
        IUniswapV3Pool _pool,
        uint256 _minimumBuyback
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

        __OwnablePausable_init(_owner);
        s_wlth = _wlth;
        s_usdc = _usdc;
        s_swapper = _swapper;
        s_pool = _pool;
        s_minimumBuyback = _minimumBuyback;
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
        uniswapSwapper.swap(usdcBalance, address(usdcToken), address(wlthToken), 3000, 0, sqrtPriceLimit);

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

    uint256[48] private __gap;
}
