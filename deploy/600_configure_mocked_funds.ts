import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
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

const configureFunds: DeployFunction = async () => {
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
    'Metaverse Fund',
    usdcAddress,
    staking,
    deploymentConfig.ownerAccount,
    deploymentConfig.investmentFundTreasuryWallet,
    deploymentConfig.genesisNftRevenueAddress,
    deploymentConfig.lpPoolAddress,
    deploymentConfig.burnAddress,
    deploymentConfig.investmentFundManagementFee,
    '1000000000000',
    fundRegistry,
    'MTF'
  );
  configureProjectForFund(
    'Illuvium',
    deploymentConfig.ownerAccount,
    usdcAddress,
    swapper,
    metaverseFund,
    '1000000000',
    'ILV'
  );
  configureProjectForFund(
    'Star Atlas',
    deploymentConfig.ownerAccount,
    usdcAddress,
    swapper,
    metaverseFund,
    '1000000000',
    'ATLAS'
  );

  const evergreenFund = await createFund(
    'Evergreen Fund',
    usdcAddress,
    staking,
    deploymentConfig.ownerAccount,
    deploymentConfig.investmentFundTreasuryWallet,
    deploymentConfig.genesisNftRevenueAddress,
    deploymentConfig.lpPoolAddress,
    deploymentConfig.burnAddress,
    deploymentConfig.investmentFundManagementFee,
    '1000000000000',
    fundRegistry,
    'EGF'
  );
  configureProjectForFund(
    'Arbitrum',
    deploymentConfig.ownerAccount,
    usdcAddress,
    swapper,
    evergreenFund,
    '1000000000',
    'ARB'
  );

  const zeroKnowledgeFund = await createFund(
    'Zero Knowledge Fund',
    usdcAddress,
    staking,
    deploymentConfig.ownerAccount,
    deploymentConfig.investmentFundTreasuryWallet,
    deploymentConfig.genesisNftRevenueAddress,
    deploymentConfig.lpPoolAddress,
    deploymentConfig.burnAddress,
    deploymentConfig.investmentFundManagementFee,
    '1000000000000',
    fundRegistry,
    'ZKF'
  );
  configureProjectForFund(
    'Starkware',
    deploymentConfig.ownerAccount,
    usdcAddress,
    swapper,
    zeroKnowledgeFund,
    '1000000000',
    'STARK'
  );

  const arbitrumEcosystemFund = await createFund(
    'Arbitrum Ecosystem Fund',
    usdcAddress,
    staking,
    deploymentConfig.ownerAccount,
    deploymentConfig.investmentFundTreasuryWallet,
    deploymentConfig.genesisNftRevenueAddress,
    deploymentConfig.lpPoolAddress,
    deploymentConfig.burnAddress,
    deploymentConfig.investmentFundManagementFee,
    '1000000000000',
    fundRegistry,
    'AEF'
  );
  configureProjectForFund(
    'Radiant',
    deploymentConfig.ownerAccount,
    usdcAddress,
    swapper,
    arbitrumEcosystemFund,
    '1000000000',
    'RXD'
  );

  const zkSyncFund = await createFund(
    'ZK Sync Fund',
    usdcAddress,
    staking,
    deploymentConfig.ownerAccount,
    deploymentConfig.investmentFundTreasuryWallet,
    deploymentConfig.genesisNftRevenueAddress,
    deploymentConfig.lpPoolAddress,
    deploymentConfig.burnAddress,
    deploymentConfig.investmentFundManagementFee,
    '1000000000000',
    fundRegistry,
    'ZKSF'
  );
  configureProjectForFund(
    'Woo Network',
    deploymentConfig.ownerAccount,
    usdcAddress,
    swapper,
    zkSyncFund,
    '1000000000',
    'WOO'
  );
};

export default configureFunds;
configureFunds.tags = ['mockFunds', 'beta'];

async function createFund(
  fundName: string,
  usdc: string,
  staking: StakingWlth,
  owner: string,
  investmentFundTreasuryWallet: string,
  genesisNftRevenueAddress: string,
  lpPoolAddress: string,
  burnAddress: string,
  investmentFundManagementFee: number,
  cap: string,
  fundRegistry: InvestmentFundRegistry,
  nftSymbol: string
): Promise<InvestmentFund> {
  const nftName = `${fundName} NFT`;
  const nftParameters = [
    { name: 'name', value: nftName },
    { name: 'symbol', value: nftSymbol },
    { name: 'owner', value: owner }
  ];
  const nft = (await deploy('InvestmentNFT', nftParameters, true, true, nftName.replace(/\s/g, ''))) as InvestmentNFT;

  const fundParameters = [
    { name: 'owner', value: owner },
    { name: 'name', value: fundName },
    { name: 'currency', value: usdc },
    { name: 'investmentNft', value: nft.address },
    { name: 'stakingWlth', value: staking.address },
    { name: 'treasuryWallet', value: investmentFundTreasuryWallet },
    { name: 'genesisNftRevenueAddress', value: genesisNftRevenueAddress },
    { name: 'lpPoolAddress', value: lpPoolAddress },
    { name: 'burnAddress', value: burnAddress },
    { name: 'managementFee', value: investmentFundManagementFee },
    { name: 'cap', value: cap }
  ];

  const investmentFund = (await deploy(
    'InvestmentFund',
    fundParameters,
    true,
    true,
    fundName.replace(/\s/g, '')
  )) as InvestmentFund;
  await nft.addMinter(investmentFund.address);
  await fundRegistry.addFund(investmentFund.address);
  await staking.registerFund(investmentFund.address);

  return investmentFund;
}

async function configureProjectForFund(
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

  const project = (await deploy('Project', projectParameters, true, true, projectName.replace(/\s/g, ''))) as Project;

  const beneficiary = owner;
  const tokenAllocation = ethers.utils.parseUnits('259200', 6);
  const durationInSeconds = 15552000; // 180 days
  const blockTimeInSeconds = 12;
  const durationInBlocks = Math.floor(durationInSeconds / blockTimeInSeconds);
  const cadence = 1;
  const cliff = 0;

  const tokenParameters = [
    { name: 'name', value: `${projectName} Token` },
    { name: 'symbol', value: tokenSymbol }
  ];

  const token = (await deploy('Token', tokenParameters, true, false)) as Token;

  const vestingParameters = [
    { name: 'token', value: token.address },
    { name: 'beneficiary', value: beneficiary },
    { name: 'startBlock', value: await ethers.provider.getBlockNumber() },
    { name: 'periods', value: [[tokenAllocation, durationInBlocks, cadence, cliff]] }
  ];

  const vesting = (await deploy('PeriodicVesting', vestingParameters, true, false)) as PeriodicVesting;

  await project.setVesting(vesting.address);
  await fund.addProject(project.address);
}
