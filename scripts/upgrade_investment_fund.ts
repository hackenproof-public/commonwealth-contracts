import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { ethers } from 'hardhat';
import { env } from 'process';
import { InvestmentFund } from '../typechain-types';
import { confirm, upgradeContract, verifyContract } from './utils';

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractToUpgrade = env.INVESTMENT_FUND_CONTRACT as string;

  console.log(`Upgrading InvestmentFund using ${deployer.address}`);
  const fund: InvestmentFund = await upgradeContract('InvestmentFund', contractToUpgrade, deployer);

  console.log(`InvestmentFund upgraded on ${fund.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    const implementationAddress = await getImplementationAddress(ethers.provider, fund.address);
    console.log('Implementation address: ', implementationAddress);
    await verifyContract(implementationAddress);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
