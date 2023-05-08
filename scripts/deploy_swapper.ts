import { ethers } from 'hardhat';
import { UniswapSwapper } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

const SWAP_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564'; // goerli
const ZERO_POINT_THREE_FEE_TIER = 3000;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying Swapper contract...');
  const swapper: UniswapSwapper = await deploy('UniswapSwapper', deployer, [SWAP_ROUTER_ADDRESS, ZERO_POINT_THREE_FEE_TIER]);

  console.log(`Swapper deployed to ${swapper.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(swapper.address, [SWAP_ROUTER_ADDRESS]);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
