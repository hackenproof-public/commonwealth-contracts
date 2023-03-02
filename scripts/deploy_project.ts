import { ethers } from 'hardhat';
import { Project } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const [deployer] = await ethers.getSigners();

  const config = ['Project 1', deployer.address];
  // const config = ['Project 2', deployer.address];

  console.log('Deploying Project contract...');
  const project: Project = await deploy('Project', deployer, config);

  console.log(`Project deployed to ${project.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(project.address, config);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
