import { NonceManager } from '@ethersproject/experimental';
import { Token } from '@uniswap/sdk-core';
import { abi as factoryAbi } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import { abi as poolAbi } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import { abi as positionManagerAbi } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import { nearestUsableTick, Pool, Position } from '@uniswap/v3-sdk';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { getContractAddress } from '../utils/addresses';

const uniswapSetup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Uniswap pool setup started');

  const uniswapPoolAddress = '0x3b314a44913163AF34255902C437744163d7590C'; // created on Base Sepolia testnet
  const uniswapFactoryAddress = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'; // taken from Uniswap docs
  const positionManagerAddress = '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2'; // taken from Uniswap docs
  const { network } = hre;
  const wlthAddress = await getContractAddress(network.config.chainId!, 'Wlth');
  const usdcAddress = await getContractAddress(network.config.chainId!, 'Wlth');

  const fee = 500; // 0.05% fee tier
  const wlthValue = 1;
  const usdcValue = 33;
  const SqrtPriceX96 = BigInt(Math.sqrt(usdcValue / wlthValue) * 2 ** 96); // for 1 WLTH you get 1/33 usdc
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );
  const usdc = await ethers.getContractAt('USDC', usdcAddress, wallet);
  const wlth = await ethers.getContractAt('Wlth', wlthAddress, wallet);
  const uniswapPool = await ethers.getContractAt(poolAbi, uniswapPoolAddress, wallet);
  const positionManager = await ethers.getContractAt(positionManagerAbi, positionManagerAddress, wallet);
  const factory = await ethers.getContractAt(factoryAbi, uniswapFactoryAddress, wallet);

  console.log('loaded pool address: ' + uniswapPoolAddress);
  console.log('loaded tokenA address: ' + wlthAddress);
  console.log('loaded tokenB address: ' + usdcAddress);
  console.log('loaded fee: ' + fee);
  console.log('wallet WLTH balance: ' + (await wlth.balanceOf(wallet.getAddress())));
  console.log('wallet USDC balance: ' + (await usdc.balanceOf(wallet.getAddress())));

  console.log(`create and initialize pool with SqrtPriceX96 ratio: ` + SqrtPriceX96);

  // const poolInitTx = await positionManager.connect(wallet).createAndInitializePoolIfNecessary(
  //   usdcAddress,
  //   wlthAddress,
  //   fee,
  //   SqrtPriceX96
  // );

  // await poolInitTx.wait(1);
  // console.log(poolInitTx);

  const poolAddresTx = await factory.connect(wallet).getPool(wlthAddress, usdcAddress, fee);

  console.log('pool address transaction: ');

  console.log(poolAddresTx);
  console.log('getting pool data...');
  const poolData = await getPoolData(uniswapPool);
  const WlthToken = new Token(84532, wlthAddress, 18, 'WLTH', 'CW Token');
  const UsdcToken = new Token(84532, usdcAddress, 6, 'USDC', 'UsdCoin');

  console.log(poolData);

  const pool = new Pool(
    WlthToken,
    UsdcToken,
    poolData.fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  );

  const position = new Position({
    pool: pool,
    liquidity: pool.liquidity,
    tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2,
    tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2
  });

  console.log('mint position: ');
  const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts;

  console.log('wlth balance: ' + (await wlth.balanceOf('0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63')));
  console.log('amount 0 desired: ' + amount0Desired.toString());
  console.log('amount 1 desired: ' + amount1Desired.toString());

  const wlthAmount = ethers.utils.parseUnits('10000000', 18);
  const usdcAmount = ethers.utils.parseUnits('10000000', 6);

  const tx1 = await wlth.approve(positionManagerAddress, wlthAmount);
  await tx1.wait(1);
  const tx2 = await usdc.approve(positionManagerAddress, usdcAmount);
  await tx2.wait(1);

  const mintParams = {
    token0: usdcAddress,
    token1: wlthAddress,
    fee: poolData.fee,
    tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2,
    tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2,
    amount0Desired: wlthAmount,
    amount1Desired: usdcAmount,
    amount0Min: 0,
    amount1Min: 0,
    recipient: await wallet.getAddress(),
    deadline: Math.floor(Date.now() / 1000) + 60 * 10
  };

  const tx = await positionManager.connect(wallet).mint(mintParams);
  const receipt = await tx.wait(1);
  console.log('mint receipt: ');
  console.log(receipt);

  console.log('get pool data again to check liquidity increase: ');
  const newPoolData = await getPoolData(uniswapPool);

  const updatedPool = new Pool(
    WlthToken,
    UsdcToken,
    newPoolData.fee,
    newPoolData.sqrtPriceX96.toString(),
    newPoolData.liquidity.toString(),
    newPoolData.tick
  );

  console.log('pool WLTH price: ' + updatedPool.priceOf(WlthToken).toSignificant());
  console.log('pool USDC price: ' + updatedPool.priceOf(UsdcToken).toSignificant());
  console.log('pool liquidity: ' + updatedPool.liquidity);
};

async function getPoolData(uniswapPool: any) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    uniswapPool.tickSpacing(),
    uniswapPool.fee(),
    uniswapPool.liquidity(),
    uniswapPool.slot0()
  ]);

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1]
  };
}

// // npx hardhat deploy --tags uniswapSetup --network baseSepolia --no-compile
export default uniswapSetup;
uniswapSetup.tags = ['uniswapSetup'];
