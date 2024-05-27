// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.18;

import {OwnablePausable} from "./OwnablePausable.sol";
import {OracleLibrary} from "./libraries/uniswap/OracleLibrary.sol";
import {IUniswapWlthPrice} from "./interfaces/IUniswapWlthPrice.sol";

error UniswapWlthPriceOracle__WlthZeroAddress();
error UniswapWlthPriceOracle__UsdcZeroAddress();
error UniswapWlthPriceOracle__PoolZeroAddress();
error UniswapWlthPriceOracle__TokenNotSupported();
error UniswapWlthPriceOracle__ZeroAmount();
error UniswapWlthPriceOracle__ObservationTimeZero();

contract UniswapWlthPriceOracle is IUniswapWlthPrice, OwnablePausable {
    /**
     * @notice Observation time
     */
    uint32 private s_observationTime;

    /**
     * @notice Address of WLTH token contract
     */
    address private s_wlth;

    /**
     * @notice Address of USDC token contract
     */
    address private s_usdc;

    /**
     * @notice Address of Uniswap V3 pool
     */
    address private s_pool;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param _owner Address of contract owner
     * @param _wlth Address of WLTH token contract
     * @param _usdc Address of USDC token contract
     * @param _pool Address of Uniswap V3 pool
     * @param _observationTime observation time
     */

    function initialize(
        address _owner,
        address _wlth,
        address _usdc,
        address _pool,
        uint32 _observationTime
    ) public initializer {
        if (_wlth == address(0)) revert UniswapWlthPriceOracle__WlthZeroAddress();
        if (_usdc == address(0)) revert UniswapWlthPriceOracle__UsdcZeroAddress();
        if (_observationTime == 0) revert UniswapWlthPriceOracle__ObservationTimeZero();

        s_wlth = _wlth;
        s_usdc = _usdc;
        s_pool = _pool;
        s_observationTime = _observationTime;

        __Context_init();
        __OwnablePausable_init(_owner);
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function setObservationTime(uint32 _newObservationTime) external override onlyOwner {
        if (_newObservationTime == 0) revert UniswapWlthPriceOracle__ObservationTimeZero();
        uint32 oldObservationTime = s_observationTime;
        s_observationTime = _newObservationTime;
        emit ObservationTimeSet(oldObservationTime, _newObservationTime);
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function setPoolAddress(address _newPool) external override onlyOwner {
        if (_newPool == address(0)) revert UniswapWlthPriceOracle__PoolZeroAddress();
        address oldPool = s_pool;
        s_pool = _newPool;
        emit PoolAddressSet(oldPool, _newPool);
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function estimateAmountOut(uint128 _amountIn) external view override returns (uint256) {
        if (_amountIn == 0) revert UniswapWlthPriceOracle__ZeroAmount();
        (int24 tick, ) = OracleLibrary.consult(s_pool, s_observationTime);

        return OracleLibrary.getQuoteAtTick(tick, _amountIn, s_wlth, s_usdc);
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function getWlthTokenAddress() external view override returns (address) {
        return s_wlth;
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function getUsdcTokenAddress() external view override returns (address) {
        return s_usdc;
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function getPoolAddress() external view override returns (address) {
        return s_pool;
    }

    uint256[48] private __gap;
}
