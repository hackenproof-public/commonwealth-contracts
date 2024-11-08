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

  const metadata = {
    name: 'Real World Asset Investment Fund',
    description: 'Invest in real world assets with this fund',
    image: 'ipfs://QmXauExHkHrdiEwV7q5uYAg6x6VmQXCL885UoQwnvLypqx',
    external_url: undefined
  };

  if (!metadata || !metadata.name || !metadata.description || !metadata.image || !metadata.external_url) {
    throw Error('Please configure metadata in the Investment Fund deployment script.');
  }

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
    { name: 'minimumValue', value: deploymentConfig.defaultMinimumInvestment },
    {
      name: 'metadata',
      value: {
        name: metadata.name,
        description: metadata.description,
        image: metadata.image,
        externalUrl: metadata.external_url
      }
    }
  ];

  const nft = await deploy(hre, 'InvestmentNFT', nftParameters, true, false);

  if (!nft) {
    throw Error('InvestmentNFT deployment failed');
  }

  const fundParameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'unlocker', value: deploymentConfig.unlocker },
    { name: 'name', value: fundName },
    { name: 'currency', value: usdc },
    { name: 'investmentNft', value: nft.address },
    { name: 'stakingWlth', value: ethers.constants.AddressZero },
    {
      name: 'feeDistributionAddresses_',
      value: {
        treasuryWallet: deploymentConfig.investmentFundTreasuryWallet,
        lpPool: deploymentConfig.lpPoolAddress,
        burn: deploymentConfig.burnAddress,
        secondarySalesWallet: deploymentConfig.secondarySalesWallet,
        genesisNftRevenue: deploymentConfig.genesisNftRevenueAddress
      }
    },
    { name: 'managementFee', value: deploymentConfig.investmentFundManagementFee },
    { name: 'cap', value: cap },
    { name: 'maxPercentageWalletInvestmentLimit', value: 200 },
    { name: 'minimumInvestment', value: deploymentConfig.defaultMinimumInvestment }
  ];

  const investmentFund = await deploy(hre, 'InvestmentFund', fundParameters, true, false);

  if (investmentFund) {
    await registerMinter(nft.address, investmentFund.address);
    await addToFundRegistry(fundRegistry, investmentFund.address);
    // await registerFundIntoStaking(stakingWlth, investmentFund.address);
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
