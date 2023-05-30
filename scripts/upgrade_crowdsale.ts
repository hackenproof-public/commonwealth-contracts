import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { ethers } from 'hardhat';
import { env } from 'process';
import { Crowdsale } from '../typechain-types';
import { confirm, upgradeContract, verifyContract } from './utils';

async function main() {
  const crowdsaleToUpgradeAddress = env.CROWDSALE_CONTRACT as string;

  const [deployer] = await ethers.getSigners();

  console.log(`upgrade using ${deployer.address}`);

  const crowdsale: Crowdsale = await upgradeContract('Crowdsale', crowdsaleToUpgradeAddress, deployer);

  console.log(`Crowdsale upgraded on ${crowdsale.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    const implementationAddress = await getImplementationAddress(ethers.provider, crowdsale.address);
    console.log('Implementation address: ', implementationAddress);
    await verifyContract(implementationAddress);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
