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
  const nftName = 'Free Fund Slice NFT';
  const nftSymbol = 'FFSL';
  const fundName = 'Free Fund';
  const cap = toUsdc('1350000');

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
    { name: 'royaltyValue', value: deploymentConfig.genesisNftRoyalty }
  ];

  const nft = await deploy(hre, 'InvestmentNFT', nftParameters, true, false);

  if (!nft) {
    throw Error('InvestmentNFT deployment failed');
  }

  // address _owner,
  // address _unlocker,
  // string memory _name,
  // address _currency,
  // address _investmentNft,
  // address _stakingWlth,
  // FeeDistributionAddresses memory _feeDistributionAddresses,
  // uint16,
  // uint256 _cap,
  // uint256

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
    { name: 'maxPercentageWalletInvestmentLimit', value: 2000 }
  ];

  const freeFund = await deploy(hre, 'FreeFund', fundParameters, true, false);

  if (freeFund) {
    await registerMinter(nft.address, freeFund.address);
    await addToFundRegistry(fundRegistry, freeFund.address);
    // await registerFundIntoStaking(stakingWlth, investmentFund.address);
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

async function registerFundIntoStaking(stakingAddress: string, freeFundAddress: string) {
  console.log(`Adding Free Fund: ${freeFundAddress} into Staking: ${stakingAddress}`);

  const staking = await ethers.getContractAt('StakingWlth', stakingAddress);

  await staking.registerFund(freeFundAddress);

  console.log('Successfully registered Free Fund into Staking');
}
