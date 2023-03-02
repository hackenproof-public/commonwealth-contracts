import { ethers } from 'hardhat';
import { Wlth } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying Wlth contract...');
  const wlth: Wlth = await deploy('Wlth', deployer, []);

  console.log(`Common Wealth Token deployed to ${wlth.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(wlth.address);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
