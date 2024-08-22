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
  const nftName = 'Test';
  const nftSymbol = 'TFT';
  const fundName = 'TEst';

  if (!nftName || !nftSymbol || !fundName) {
    throw Error(' Please configure nfName, nftSymbol and fundName in the Investment Fund deployment script.');
  }

  const usdc = await getContractAddress(network.config.chainId!, 'USDC');
  const fundRegistry = await getContractAddress(network.config.chainId!, 'InvestmentFundRegistry');
  const stakingWlth = await getContractAddress(network.config.chainId!, 'StakingWlth');
  const marketplace = await getContractAddress(network.config.chainId!, 'Marketplace');

  const metadata: any = {
    name: 'Perpetual Fund Slice',
    description: 'Perpetual Fund Description',
    image: 'ipfs://QmQv1',
    externalUrl: 'https://www.perpetualfund.com'
  };

  const nftParameters = [
    { name: 'name', value: nftName },
    { name: 'symbol', value: nftSymbol },
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'royaltyAccount', value: deploymentConfig.genesisNftRoyaltyAccount },
    { name: 'royaltyValue', value: deploymentConfig.nftRoyalty },
    { name: 'minimumValue', value: deploymentConfig.alphaFundMinimumInvestment },
    { name: 'profitDistributor', value: deploymentConfig.profitDistributor },
    { name: 'metadata', value: metadata },
    { name: 'marketplace', value: marketplace }
  ];

  const nft = await deploy(hre, 'PerpetualNFT', nftParameters, true, false);

  if (!nft) {
    throw Error('PerpetualNFT deployment failed');
  }

  console.log(deploymentConfig.investmentFundManagementFee);

  const fundParameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'currency', value: usdc },
    { name: 'perpetualNFT', value: nft.address },
    { name: 'stakingWlth', value: stakingWlth },
    {
      name: 'config',
      value: {
        name: fundName,
        managementFee: deploymentConfig.investmentFundManagementFee,
        minimumInvestment: toUsdc('100'),
        revenueWallet: deploymentConfig.investmentFundTreasuryWallet,
        lpPoolWallet: deploymentConfig.lpPoolAddress,
        buybackAndBurnWallet: deploymentConfig.burnAddress,
        secondarySalesWallet: deploymentConfig.secondarySalesWallet
      }
    },
    { name: 'profitProvider', value: deploymentConfig.ownerAccount },
    { name: 'profitGenerator', value: deploymentConfig.profitGenerator },
    { name: 'profitDistributor', value: deploymentConfig.profitDistributor }
  ];

  const perpetualFund = await deploy(hre, 'PerpetualFund', fundParameters, true, false);

  if (perpetualFund) {
    await registerMinter(nft.address, perpetualFund.address);
    await addToFundRegistry(fundRegistry, perpetualFund.address);
    await registerFundIntoStaking(stakingWlth, perpetualFund.address);
    await setPerpetualFundInNFT(nft.address, perpetualFund.address);
  }
};

export default deployAlphaFund;
deployAlphaFund.tags = ['perpetualFund'];

async function addToFundRegistry(fundRegistryAddress: string, perpetualFundAddress: string) {
  console.log(`Registering PerpetualFund: ${perpetualFundAddress} in InvestmentFundRegistry: ${fundRegistryAddress}`);

  const fundRegistry = await ethers.getContractAt('InvestmentFundRegistry', fundRegistryAddress);

  const tx = await fundRegistry.addFund(perpetualFundAddress);
  await tx.wait();

  console.log('PerpetualFund successfully registered in InvestmentFundRegistry');
}

async function registerMinter(perpetualFundNftAddress: string, perpetualFundAddress: string) {
  console.log(
    `Registering PerpetualFund: ${perpetualFundAddress} as minter for InvestmentNFT: ${perpetualFundNftAddress}`
  );
  const investmentNFT: InvestmentNFT = (await ethers.getContractAt(
    'InvestmentNFT',
    perpetualFundNftAddress
  )) as InvestmentNFT;

  const tx = await investmentNFT.addMinter(perpetualFundAddress);
  await tx.wait();

  console.log('Successfully registered InvestmentFund as minter for InvestmentNFT');
}

async function registerFundIntoStaking(stakingAddress: string, perpetualFundAddress: string) {
  console.log(`Adding InvestmentFund: ${perpetualFundAddress} into Staking: ${stakingAddress}`);

  const staking = await ethers.getContractAt('StakingWlth', stakingAddress);

  const tx = await staking.registerFund(perpetualFundAddress);
  await tx.wait();

  console.log('Successfully registered InvestmentFund into Staking');
}

async function setPerpetualFundInNFT(nftAddress: string, perpetualFundAddress: string) {
  console.log(`Setting PerpetualFund: ${perpetualFundAddress} in PerpetualNFT: ${nftAddress}`);

  const nft = await ethers.getContractAt('PerpetualNFT', nftAddress);
  const tx = await nft.setPerpetualFund(perpetualFundAddress);
  await tx.wait();

  console.log('Successfully set PerpetualFund in PerpetualNFT');
}
