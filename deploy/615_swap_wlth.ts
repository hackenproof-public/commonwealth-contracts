import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { toWlth } from '../test/utils';
import { getContractAddress } from '../utils/addresses';

const uniswapSetup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Uniswap example swap WLTH token to WETH');
  const { network } = hre;

  const wlthAddress = await getContractAddress(network.config.chainId!, 'Wlth');
  const usdcAddress = await getContractAddress(network.config.chainId!, 'Wlth');
  const swapperAddress = await getContractAddress(network.config.chainId!, 'UniswapSwapper');

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );
  const uniswapSwapper = await ethers.getContractAt('UniswapSwapper', swapperAddress, wallet);
  const wlth = await ethers.getContractAt('Wlth', wlthAddress, wallet);

  const amountIn = toWlth('100');
  const sourceToken = wlthAddress;
  const targetToken = usdcAddress;
  const amountOutMinimum = 0;
  const sqrtPriceLimitX96 = 0;

  // approve is required to send input tokens to our swapper, which will pass the WLTH to

  const tx1 = await wlth.connect(wallet).approve(swapperAddress, amountIn);
  await tx1.wait(1);

  // execute transaction
  const tx2 = await uniswapSwapper.swap(amountIn, sourceToken, targetToken, amountOutMinimum, sqrtPriceLimitX96);
  await tx2.wait(1);
  console.log('Swapped ', amountIn.toString(), ' WLTH for ', tx2, 'WETH');
};

// // npx hardhat deploy --tags wlthPrice --network baseSepolia --no-compile
export default uniswapSetup;
uniswapSetup.tags = ['wlthSwap'];
