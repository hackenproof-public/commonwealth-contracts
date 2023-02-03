import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { InvestmentFundRegistry } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const [deployer]: SignerWithAddress[] = await ethers.getSigners();

  console.log(`Deploying Investment Fund Registry contract...`);
  const investmentFundRegistry: InvestmentFundRegistry = await deploy('InvestmentFundRegistry', deployer, []);

  console.log(`Investment Fund Registry deployed to ${investmentFundRegistry.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(investmentFundRegistry.address);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
