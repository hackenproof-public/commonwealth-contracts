import hre, { ethers } from 'hardhat';
import { env } from 'process';
import { USDC as InvestmentNFT } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const owner = env.OWNER_ACCOUNT;
  const contractName = 'Common Wealth Investment NFT';
  const contractSymbol = 'CWI';

  const [deployer] = await ethers.getSigners();

  console.log(
    `Running Investment NFT deployment script on network ${hre.network.name} (chainId: ${hre.network.config.chainId})`
  );
  console.log('\nParameters');
  console.log(` contractName: ${contractName}`);
  console.log(` contractSymbol: ${contractSymbol}`);
  console.log(` owner: ${owner}`);

  if (await confirm('\nDo you want to continue? [y/N] ')) {
    console.log('Deploying Investment NFT contract...');
    const investmentNft: InvestmentNFT = await deploy('InvestmentNFT', deployer, [contractName, contractSymbol, owner]);

    console.log(`Investment NFT deployed to ${investmentNft.address}`);

    if (await confirm('\nDo you want to verify contract? [y/N] ')) {
      await verifyContract(investmentNft.address, [contractName, contractSymbol, owner]);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
