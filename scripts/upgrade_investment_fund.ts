import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { ethers, network } from 'hardhat';
import { InvestmentFund } from '../typechain-types';
import { confirm, getEnvByNetwork, upgradeContract, verifyContract } from './utils';

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractToUpgrade = getEnvByNetwork('INVESTMENT_FUND_CONTRACT', network.name) as string;

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
