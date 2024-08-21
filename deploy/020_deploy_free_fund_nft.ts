import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { toUsdc } from '../test/utils';
import { InvestmentNFT } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployFreeFund: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;
  const deploymentConfig = getDeploymentConfig();
  //Needs to be configure for every Fund deployment
  const nftName = "Priceless Fund 'Slice'";
  const nftSymbol = 'PRICELESS';
  const fundName = 'Priceless Fund';
  const cap = toUsdc('1350000');

  if (!nftName || !nftSymbol || !fundName || !cap) {
    throw Error(' Please configure nfName, nftSymbol, fundName and cap in the Investment Fund deployment script.');
  }

  const usdc = await getContractAddress(network.config.chainId!, 'USDC');
  const fundRegistry = await getContractAddress(network.config.chainId!, 'InvestmentFundRegistry');

  const metadata: any = {
    name: "Priceless Fund 'Slice'",
    description: 'Priceless Fund NFT',
    image: 'https://gateway.pinata.cloud/ipfs/QmQp6Wk8v6X5Z5Q9ZPjV1Q9u1y1dQ7vF5d5w3YgU7oq4Zp',
    externalUrl: 'https://priceless.fund'
  };

  const nftParameters = [
    { name: 'name', value: nftName },
    { name: 'symbol', value: nftSymbol },
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'royaltyAccount', value: deploymentConfig.genesisNftRoyaltyAccount },
    { name: 'royaltyValue', value: deploymentConfig.nftRoyalty },
    { name: 'minimumValue', value: deploymentConfig.pricelessFundMinimumInvestment },
    { name: 'metadata', value: metadata }
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
    { name: 'managementFee', value: 0 },
    { name: 'cap', value: cap },
    { name: 'maxPercentageWalletInvestmentLimit', value: 200 },
    { name: 'minimumInvestment', value: deploymentConfig.pricelessFundMinimumInvestment }
  ];

  const freeFund = await deploy(hre, 'FreeFund', fundParameters, true, false);

  if (freeFund) {
    await registerMinter(nft.address, freeFund.address);
    await addToFundRegistry(fundRegistry, freeFund.address);
  }
};

export default deployFreeFund;
deployFreeFund.tags = ['freeFund'];

async function addToFundRegistry(fundRegistryAddress: string, freeFundAddress: string) {
  console.log(`Registering Free Fund: ${freeFundAddress} in InvestmentFundRegistry: ${fundRegistryAddress}`);

  const fundRegistry = await ethers.getContractAt('InvestmentFundRegistry', fundRegistryAddress);

  await fundRegistry.addFund(freeFundAddress);

  console.log('Free Fund successfully registered in InvestmentFundRegistry');
}

async function registerMinter(freeFundNftAddress: string, freeFundAddress: string) {
  console.log(`Registering Free Fund: ${freeFundAddress} as minter for InvestmentNFT: ${freeFundNftAddress}`);
  const investmentNFT: InvestmentNFT = (await ethers.getContractAt(
    'InvestmentNFT',
    freeFundNftAddress
  )) as InvestmentNFT;

  await investmentNFT.addMinter(freeFundAddress);

  console.log('Successfully registered Free Fund as minter for InvestmentNFT');
}
