import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { formatEther } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';
import { Wlth } from '../typechain-types';
import { confirm, getEnvByNetwork, upgradeContract, verifyContract } from './utils';

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractName = 'Wlth';
  const contractToUpgrade = getEnvByNetwork('WLTH_CONTRACT', network.name) as string;

  console.log(`Running ${contractName} upgrade script on network ${network.name} (chainId: ${network.config.chainId})`);
  console.log('\nDeployer');
  console.log(` address: ${deployer.address}`);
  console.log(` balance: ${formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  if (await confirm('\nDo you want to continue? [y/N] ')) {
    const wlth: Wlth = await upgradeContract(contractName, contractToUpgrade, deployer);

    const implementationAddress = await getImplementationAddress(ethers.provider, wlth.address);
    console.log(`${contractName} upgraded on ${wlth.address}`);
    console.log(`New implementation: ${implementationAddress}`);

    if (await confirm('\nDo you want to verify contract? [y/N] ')) {
      await verifyContract(implementationAddress);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
