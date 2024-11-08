import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { toUsdc } from '../test/utils';
import { InvestmentNFT } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployInvestmentFund: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;
  const deploymentConfig = getDeploymentConfig();

  //Needs to be configure for every Fund deployment
  const nftName = 'RWA Investment Fund NFT';
  const nftSymbol = 'RWAIF';
  const fundName = 'Real World Asset Investment Fund';
  const cap = toUsdc('10000000');

  if (!nftName || !nftSymbol || !fundName || !cap) {
    throw Error(' Please configure nfName, nftSymbol, fundName and cap in the Investment Fund deployment script.');
  }

  const usdc = await getContractAddress(network.config.chainId!, 'USDC');
  // const stakingWlth = await getContractAddress(network.config.chainId!, 'StakingWlth');
  const fundRegistry = await getContractAddress(network.config.chainId!, 'InvestmentFundRegistry');

  const nftParameters = [
    { name: 'name', value: nftName },
    { name: 'symbol', value: nftSymbol },
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'royaltyAccount', value: deploymentConfig.genesisNftRoyaltyAccount },
    { name: 'royaltyValue', value: deploymentConfig.nftRoyalty },
    { name: 'minimumValue', value: deploymentConfig.defaultMinimumInvestment }
  ];

  const nft = await deploy(hre, 'InvestmentNFTOld', nftParameters, true, false);

  if (!nft) {
    throw Error('InvestmentNFT deployment failed');
  }

};

export default deployInvestmentFund;
deployInvestmentFund.tags = ['investmentFundOld'];

async function addToFundRegistry(fundRegistryAddress: string, investmentFundAddress: string) {
  console.log(`Registering InvestmentFund: ${investmentFundAddress} in InvestmentFundRegistry: ${fundRegistryAddress}`);

  const fundRegistry = await ethers.getContractAt('InvestmentFundRegistry', fundRegistryAddress);

  await fundRegistry.addFund(investmentFundAddress);

  console.log('InvestmentFund successfully registered in InvestmentFundRegistry');
}

async function registerMinter(investmentFundNftAddress: string, investmentFundAddress: string) {
  console.log(
    `Registering InvestmentFund: ${investmentFundAddress} as minter for InvestmentNFT: ${investmentFundNftAddress}`
  );
  const investmentNFT: InvestmentNFT = (await ethers.getContractAt(
    'InvestmentNFT',
    investmentFundNftAddress
  )) as InvestmentNFT;

  await investmentNFT.addMinter(investmentFundAddress);

  console.log('Successfully registered InvestmentFund as minter for InvestmentNFT');
}

async function registerFundIntoStaking(stakingAddress: string, investmentFundAddress: string) {
  console.log(`Adding InvestmentFund: ${investmentFundAddress} into Staking: ${stakingAddress}`);

  const staking = await ethers.getContractAt('StakingWlth', stakingAddress);

  await staking.registerFund(investmentFundAddress);

  console.log('Successfully registered InvestmentFund into Staking');
}
