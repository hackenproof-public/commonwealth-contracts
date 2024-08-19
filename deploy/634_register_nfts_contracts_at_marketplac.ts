import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { InvestmentFund, InvestmentFundRegistry, Marketplace } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const registerNftsAtMarketplace: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const genesisNFT1Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1');
  const genesisNFT2Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV2');
  const fundRegistryAddress = await getContractAddress(hre.network.config.chainId!, 'InvestmentFundRegistry');
  const marketplaceAddress = await getContractAddress(hre.network.config.chainId!, 'Marketplace');

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const fundRegistry = (await ethers.getContractAt(
    'InvestmentFundRegistry',
    fundRegistryAddress,
    wallet
  )) as InvestmentFundRegistry;
  const marketplace = (await ethers.getContractAt('Marketplace', marketplaceAddress, wallet)) as Marketplace;

  console.log('Registering NFTs at Marketplace');

  console.log(`Registering GenesisNFTV1 (${genesisNFT1Address}) at Marketplace`);
  const registerGenesisNFT1Tx = await marketplace.addAllowedContract(genesisNFT1Address);
  await registerGenesisNFT1Tx.wait();
  console.log('GenesisNFTV1 registered at Marketplace', registerGenesisNFT1Tx.hash);

  console.log(`Registering GenesisNFTV2  (${genesisNFT2Address}) at Marketplace`);
  const registerGenesisNFT2Tx = await marketplace.addAllowedContract(genesisNFT2Address);
  await registerGenesisNFT2Tx.wait();
  console.log('GenesisNFTV2 registered at Marketplace', registerGenesisNFT2Tx.hash);

  console.log('Registering investment nfts at Marketplace');
  const funds = await fundRegistry.listFunds();

  for (const fund of funds) {
    const investmentFund: InvestmentFund = (await ethers.getContractAt(
      'InvestmentFund',
      fund,
      wallet
    )) as InvestmentFund;

    const investmentNftAddress = await investmentFund.investmentNft();

    console.log(`Registering ${await investmentFund.name()} slices (${investmentNftAddress}) at Marketplace`);
    const registerFundTx = await marketplace.addAllowedContract(investmentNftAddress);
    await registerFundTx.wait();
    console.log(`${await investmentFund.name()} slices registered at Marketplace`, registerFundTx.hash);
  }

  console.log('Done');
};

export default registerNftsAtMarketplace;
registerNftsAtMarketplace.tags = ['registerNftsAtMarketplace'];
