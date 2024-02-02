import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Provider, Wallet } from 'zksync-web3';
import { networkConfigItem } from '../helper-hardhat-config';
import { getEnvByNetwork } from '../scripts/utils';
import {
  InvestmentFund,
  InvestmentFundRegistry,
  InvestmentNFT,
  PeriodicVesting,
  Project,
  StakingWlth,
  Token
} from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const configureFunds: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();
  const chainId = network.config.chainId!;
  const fundRegistryAddress = await getContractAddress(chainId, 'InvestmentFundRegistry');
  const stakingAddress = await getContractAddress(chainId, 'StakingWlth');
  const usdcAddress = await getContractAddress(chainId, 'USDC');
  const swapper = await getContractAddress(chainId, 'UniswapSwapper');

  const fundRegistry = (await ethers.getContractAt(
    'InvestmentFundRegistry',
    fundRegistryAddress
  )) as InvestmentFundRegistry;
  const staking = (await ethers.getContractAt('StakingWlth', stakingAddress)) as StakingWlth;

  const metaverseFund = await createFund(
    hre,
    'Metaverse Fund',
    usdcAddress,
    staking,
    deploymentConfig,
    '3000000000000',
    fundRegistry,
    'MTF'
  );
  // await deployProject(
  //   hre,
  //   'Illuvium',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   metaverseFund,
  //   '200000000000',
  //   'ILV'
  // );
  // await deployProject(
  //   hre,
  //   'Star Atlas',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   metaverseFund,
  //   '200000000000',
  //   'ATLAS'
  // );

  const aiWeb3Fund = await createFund(
    hre,
    'AI & Web3 Fund',
    usdcAddress,
    staking,
    deploymentConfig,
    '5000000000000',
    fundRegistry,
    'AIWF'
  );

  // await deployProject(
  //   hre,
  //   'Paal AI',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   aiWeb3Fund,
  //   '200000000000',
  //   'PAAL'
  // );
  // await deployProject(
  //   hre,
  //   'Dynex',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   aiWeb3Fund,
  //   '200000000000',
  //   'DNX'
  // );
  // await deployProject(
  //   hre,
  //   'Bittensor',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   aiWeb3Fund,
  //   '200000000000',
  //   'TAO'
  // );
  // await deployProject(
  //   hre,
  //   'Worldcoin',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   aiWeb3Fund,
  //   '200000000000',
  //   'WLD'
  // );

  // const evergreenFund = await createFund(
  //   hre,
  //   'Evergreen Fund',
  //   usdcAddress,
  //   staking,
  //   deploymentConfig,
  //   '1000000000000',
  //   fundRegistry,
  //   'EGF'
  // );
  // await deployProject(
  //   hre,
  //   'Arbitrum',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   evergreenFund,
  //   '200000000000',
  //   'ARB'
  // );

  // const zeroKnowledgeFund = await createFund(
  //   hre,
  //   'Zero Knowledge Fund',
  //   usdcAddress,
  //   staking,
  //   deploymentConfig,
  //   '1000000000000',
  //   fundRegistry,
  //   'ZKF'
  // );
  // await deployProject(
  //   hre,
  //   'Starkware',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   zeroKnowledgeFund,
  //   '200000000000',
  //   'STARK'
  // );

  const arbitrumEcosystemFund = await createFund(
    hre,
    'Arbitrum Ecosystem Fund',
    usdcAddress,
    staking,
    deploymentConfig,
    '1000000000000',
    fundRegistry,
    'AEF'
  );
  // await deployProject(
  //   hre,
  //   'Radiant',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   arbitrumEcosystemFund,
  //   '200000000000',
  //   'RXD'
  // );

  const zkSyncFund = await createFund(
    hre,
    'ZK Sync Fund',
    usdcAddress,
    staking,
    deploymentConfig,
    '1000000000000',
    fundRegistry,
    'ZKSF'
  );
  // await deployProject(
  //   hre,
  //   'Woo Network',
  //   deploymentConfig.ownerAccount,
  //   usdcAddress,
  //   swapper,
  //   zkSyncFund,
  //   '200000000000',
  //   'WOO'
  // );
};

export default configureFunds;
configureFunds.tags = ['mockFunds', 'beta'];

async function createFund(
  hre: HardhatRuntimeEnvironment,
  fundName: string,
  usdc: string,
  staking: StakingWlth,
  deploymentConfig: networkConfigItem,
  cap: string,
  fundRegistry: InvestmentFundRegistry,
  nftSymbol: string
): Promise<InvestmentFund> {
  const nftName = `${fundName} NFT`;
  const nftParameters = [
    { name: 'name', value: nftName },
    { name: 'symbol', value: nftSymbol },
    { name: 'owner', value: deploymentConfig.ownerAccount }
  ];

  const nft = (await deploy(hre, 'InvestmentNFT', nftParameters, true, false)) as InvestmentNFT;
  const fundParameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'unlocker', value: deploymentConfig.unlocker },
    { name: 'name', value: fundName },
    { name: 'currency', value: usdc },
    { name: 'investmentNft', value: nft.address },
    { name: 'stakingWlth', value: staking.address },
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
    { name: 'cap', value: cap }
  ];

  const investmentFund = (await deploy(hre, 'InvestmentFund', fundParameters, true, false)) as InvestmentFund;

  await configureFund(investmentFund.address, nft.address, fundRegistry.address, staking.address);

  return investmentFund;
}

async function configureFund(fundAddress: string, nftAddress: string, registryAddress: string, stakingAddress: string) {
  console.log(`Configure fund ${fundAddress} with NFT ${nftAddress} and registry ${registryAddress}`);

  console.log(registryAddress);
  // const wallet = getSingerWallet();

  const provider = new ethers.providers.JsonRpcProvider('https://sepolia.era.zksync.dev');
  const wallet = new ethers.Wallet('f1a503f2394a2445abc84a65e6a4e28c4496b65b0c6e28a63ad8b924cb1b7232', provider);

  const nft = await ethers.getContractAt('InvestmentNFT', nftAddress, wallet);
  const registry = await ethers.getContractAt('InvestmentFundRegistry', registryAddress, wallet);
  const staking = await ethers.getContractAt('StakingWlth', stakingAddress, wallet);

  console.log(registry.address);
  await nft.addMinter(fundAddress);
  await registry.addFund(fundAddress);
  await staking.registerFund(fundAddress);

  console.log(`Fund ${fundAddress} configured`);
}

async function deployProject(
  hre: HardhatRuntimeEnvironment,
  projectName: string,
  owner: string,
  usdcAddress: string,
  swapperAddress: string,
  fund: InvestmentFund,
  fundsAllocation: string,
  tokenSymbol: string
) {
  const projectParameters = [
    { name: 'name', value: projectName },
    { name: 'owner', value: owner },
    { name: 'token', value: usdcAddress },
    { name: 'swapper', value: swapperAddress },
    { name: 'investmentFund', value: fund.address },
    { name: 'fundsAllocation', value: fundsAllocation }
  ];

  const project = (await deploy(hre, 'Project', projectParameters, true, false)) as Project;

  const beneficiary = project.address;
  const tokenAllocation = ethers.utils.parseUnits('200000', 6);
  const durationInSeconds = 86400 * 180; // 180 days
  const cadence = 86400 * 30;
  const cliff = 0;

  const tokenParameters = [
    { name: 'name', value: `${projectName} Token` },
    { name: 'symbol', value: tokenSymbol }
  ];

  const token = (await deploy(hre, 'Token', tokenParameters, true, false)) as Token;

  const vestingParameters = [
    { name: 'token', value: token.address },
    { name: 'beneficiary', value: beneficiary },
    { name: 'startTimestamp', value: (await ethers.provider.getBlock('latest')).timestamp },
    { name: 'periods', value: [[tokenAllocation, durationInSeconds, cadence, cliff]] }
  ];

  const vesting = (await deploy(hre, 'PeriodicVesting', vestingParameters, true, false)) as PeriodicVesting;

  await configureProjectForFund(fund.address, project.address, vesting.address);
}

async function configureProjectForFund(fundAddress: string, projectAddress: string, vestingAddress: string) {
  console.log(`Configuring project ${projectAddress} for fund ${fundAddress}`);

  const wallet = getSingerWallet();

  const fund = await ethers.getContractAt('InvestmentFund', fundAddress, wallet);
  const project = await ethers.getContractAt('Project', projectAddress, wallet);

  await project.setVesting(vestingAddress);
  await fund.addProject(projectAddress);

  console.log(`Project ${projectAddress} configured for fund ${fundAddress}`);
}

// function getSingerWallet() {
//   const deployerPrivateKey = getEnvByNetwork('WALLET_PRIVATE_KEY', network.name)!;
//   const provider = new ethers.providers.JsonRpcProvider('https://devnet.neonevm.org');
//   return new ethers.Wallet(deployerPrivateKey, provider);
// }

function getSingerWallet() {
  const deployerPrivateKey = getEnvByNetwork('WALLET_PRIVATE_KEY', network.name)!;

  const zkSyncProvider = new Provider('https://sepolia.era.zksync.dev'); // need to be changed to mainnet when mainnet lunch
  const ethereumProvider = ethers.getDefaultProvider('sepolia'); // need to be changed to mainnet when mainnet lunch

  return new Wallet(deployerPrivateKey, zkSyncProvider, ethereumProvider);
}
