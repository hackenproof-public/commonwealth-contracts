import { ethers } from 'hardhat';
import { USDC } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying USDC contract...');
  const usdc: USDC = await deploy('USDC', [], deployer);

  console.log(`USD Coin deployed to ${usdc.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(usdc.address);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
