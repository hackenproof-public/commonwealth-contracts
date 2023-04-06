import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import hre, { ethers } from 'hardhat';
import { env } from 'process';
import { Crowdsale } from '../typechain-types';
import { confirm, deployProxy, verifyContract } from './utils';

async function main() {
  const owner = env.OWNER_ACCOUNT;
  const crowdsaleWallet = env.CROWDSALE_WALLET;
  const usdcAddress = env.USDC_CONTRACT;
  const genesisNftAddress = env.GENESIS_NFT_CONTRACT;
  const supply = env.CROWDSALE_TOKEN_SUPPLY;
  const nftPrice = env.CROWDSALE_TOKEN_PRICE;
  const tokenUri = env.CROWDSALE_TOKEN_URI;

  const [deployer] = await ethers.getSigners();

  console.log(
    `Running Crowdsale deployment script on network ${hre.network.name} (chainId: ${hre.network.config.chainId})`
  );
  console.log('\nParameters');
  console.log(` owner: ${owner}`);
  console.log(` crowdsale wallet: ${crowdsaleWallet}`);
  console.log(` USDC: ${usdcAddress}`);
  console.log(` Genesis NFT: ${genesisNftAddress}`);
  console.log(` tokens supply: ${supply}`);
  console.log(` tokens price: ${nftPrice}`);
  console.log(` token URI: ${tokenUri}`);

  if (await confirm('\nDo you want to continue? [y/N] ')) {
    const crowdsale: Crowdsale = await deployProxy('Crowdsale', deployer, [
      owner,
      crowdsaleWallet,
      usdcAddress,
      genesisNftAddress,
      supply,
      nftPrice,
      tokenUri
    ]);

    console.log(`Crowdsale deployed to ${crowdsale.address}`);

    if (await confirm('\nDo you want to verify contract? [y/N] ')) {
      const implementationAddress = await getImplementationAddress(ethers.provider, crowdsale.address);
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
