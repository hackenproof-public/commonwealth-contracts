import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { toUsdc } from '../test/utils';
import { InvestmentNFT } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployAlphaFund: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;
  const deploymentConfig = getDeploymentConfig();

  //Needs to be configure for every Fund deployment
  const nftName = "Alpha Fund 'Slice'";
  const nftSymbol = 'ALPHA';
  const fundName = 'Alpha Fund';
  const cap = toUsdc('1000000');

  if (!nftName || !nftSymbol || !fundName || !cap) {
    throw Error(' Please configure nfName, nftSymbol, fundName and cap in the Investment Fund deployment script.');
  }

  const usdc = await getContractAddress(network.config.chainId!, 'USDC');
  const fundRegistry = await getContractAddress(network.config.chainId!, 'InvestmentFundRegistry');

  const nftParameters = [
    { name: 'name', value: nftName },
    { name: 'symbol', value: nftSymbol },
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'royaltyAccount', value: deploymentConfig.genesisNftRoyaltyAccount },
    { name: 'royaltyValue', value: deploymentConfig.genesisNftRoyalty },
    { name: 'minimumValue', value: deploymentConfig.alphaFundMinimumInvestment }
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
        communityFund: deploymentConfig.communityFundWallet,
        genesisNftRevenue: deploymentConfig.genesisNftRevenueAddress
      }
    },
    { name: 'managementFee', value: deploymentConfig.investmentFundManagementFee },
    { name: 'cap', value: cap },
    { name: 'maxPercentageWalletInvestmentLimit', value: 200 }, // 200 = 2%
    { name: 'minimumInvestment', value: deploymentConfig.alphaFundMinimumInvestment }
  ];

  const investmentFund = await deploy(hre, 'InvestmentFund', fundParameters, true, false);

  if (investmentFund) {
    await registerMinter(nft.address, investmentFund.address);
    await addToFundRegistry(fundRegistry, investmentFund.address);
  }
};

export default deployAlphaFund;
deployAlphaFund.tags = ['alphaFund'];

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
