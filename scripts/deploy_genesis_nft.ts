import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { ethers } from 'hardhat';
import { env } from 'process';
import { GenesisNFT } from '../typechain-types';
import { confirm, deployProxy, verifyContract } from './utils';

async function main() {
  const owner = env.OWNER_ACCOUNT;
  const royaltyAccount = env.GENESIS_NFT_ROYALTY_ACCOUNT;
  const royalty = env.GENESIS_NFT_ROYALTY;

  const [deployer] = await ethers.getSigners();

  console.log('Deploying Genesis NFT contract...');
  console.log('Parameters');
  console.log(` owner: ${owner}`);
  console.log(` royaltyAccount: ${royaltyAccount}`);
  console.log(` royalty: ${royalty}`);

  const genesisNft: GenesisNFT = await deployProxy('GenesisNFT', deployer, [owner, royaltyAccount, royalty]);

  console.log(`Genesis NFT deployed to ${genesisNft.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    const implementationAddress = await getImplementationAddress(ethers.provider, genesisNft.address);
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
