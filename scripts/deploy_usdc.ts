import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { USDC } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const [deployer]: SignerWithAddress[] = await ethers.getSigners();

  console.log(`Deploying USDC contract...`);
  const usdc: USDC = await deploy('USDC', deployer, []);

  console.log(`USD Coin deployed to ${usdc.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(usdc.address);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
