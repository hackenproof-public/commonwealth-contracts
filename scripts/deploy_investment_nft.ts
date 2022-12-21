import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { USDC as InvestmentNFT } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const [deployer]: SignerWithAddress[] = await ethers.getSigners();

  console.log(`Deploying Investment NFT contract...`);
  const invNft: InvestmentNFT = await deploy('InvestmentNFT', deployer, []);

  console.log(`Investment NFT deployed to ${invNft.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(invNft.address);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
