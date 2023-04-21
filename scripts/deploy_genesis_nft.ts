import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import hre, { ethers } from 'hardhat';
import { env } from 'process';
import { GenesisNFT } from '../typechain-types';
import { confirm, deployProxy, verifyContract } from './utils';

async function main() {
  const owner = env.OWNER_ACCOUNT;
  const royaltyAccount = env.GENESIS_NFT_ROYALTY_ACCOUNT;
  const royalty = env.GENESIS_NFT_ROYALTY;
  const tokenURI = env.GENESIS_NFT_TOKEN_URI;

  const [deployer] = await ethers.getSigners();

  console.log(
    `Running Genesis NFT deployment script on network ${hre.network.name} (chainId: ${hre.network.config.chainId})`
  );
  console.log('\nParameters');
  console.log(` owner: ${owner}`);
  console.log(` royaltyAccount: ${royaltyAccount}`);
  console.log(` royalty: ${royalty}`);
  console.log(` tokenURI: ${tokenURI}`);

  if (await confirm('\nDo you want to continue? [y/N] ')) {
    console.log('Deploying Genesis NFT contract...');

    const genesisNft: GenesisNFT = await deployProxy('GenesisNFT', deployer, [
      owner,
      royaltyAccount,
      royalty,
      tokenURI
    ]);

    console.log(`Genesis NFT deployed to ${genesisNft.address}`);

    if (await confirm('\nDo you want to verify contract? [y/N] ')) {
      const implementationAddress = await getImplementationAddress(ethers.provider, genesisNft.address);
      console.log('Implementation address: ', implementationAddress);
      await verifyContract(implementationAddress);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
