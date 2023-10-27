import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { InvestmentNFT } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployInvestmentFund: DeployFunction = async ({ network, deployments }) => {
  const deploymentCofing = getDeploymentConfig();

  //Needs to be configure for every Fund deployment
  const nftName = undefined;
  const nftSymbol = undefined;
  const fundName = undefined;
  const cap = undefined;

  if (!nftName || !nftSymbol || !fundName || !cap) {
    throw Error(' Please configure nfName, nftSymbol, fundName and cap in the Investment Fund deployment script.');
  }

  const usdc = await getContractAddress(network.config.chainId!, 'USDC');
  const stakingWlth = await getContractAddress(network.config.chainId!, 'StakingWlth');
  const fundRegistry = await getContractAddress(network.config.chainId!, 'InvestmentFundRegistry');

  const nftParameters = [
    { name: 'name', value: nftName },
    { name: 'symbol', value: nftSymbol },
    { name: 'owner', value: deploymentCofing.ownerAccount }
  ];

  const nft = await deploy('InvestmentNFT', nftParameters, true, false);

  if (!nft) {
    throw Error('InvestmentNFT deployment failed');
  }

  const fundParameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'name', value: fundName },
    { name: 'currency', value: usdc },
    { name: 'investmentNft', value: nft.address },
    { name: 'stakingWlth', value: stakingWlth },
    { name: 'treasuryWallet', value: deploymentCofing.investmentFundTreasuryWallet },
    { name: 'genesisNftRevenueAddress', value: deploymentCofing.genesisNftRevenueAddress },
    { name: 'lpPoolAddress', value: deploymentCofing.lpPoolAddress },
    { name: 'burnAddress', value: deploymentCofing.burnAddress },
    { name: 'managementFee', value: deploymentCofing.investmentFundManagementFee },
    { name: 'cap', value: cap }
  ];

  const investmentFund = await deploy('InvestmentFund', fundParameters, true, false);

  if (investmentFund) {
    await registerMinter(nft.address, investmentFund.address);
    await addToFundRegistry(fundRegistry, investmentFund.address);
    await registerFundIntoStaking(stakingWlth, investmentFund.address);
  }
};

export default deployInvestmentFund;
deployInvestmentFund.tags = ['investmentFund'];

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
