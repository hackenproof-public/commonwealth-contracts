import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { BigNumber, Contract, Signer, Wallet } from 'ethers';
import hre, { ethers } from 'hardhat';
import { env } from 'process';
import { toUsdc } from '../test/utils';
import { InvestmentFund, InvestmentNFT, PeriodicVesting, Project, Token } from '../typechain-types';
import { deploy, deployProxy, getEnvByNetwork, verifyContract } from './utils';

export async function deployAndVerify<Type extends Contract>(
  contractName: string,
  parameters: any[],
  deployer?: Signer
): Promise<Type> {
  if (deployer === undefined) {
    [deployer] = await ethers.getSigners();
  }

  console.log(`Deploying ${contractName} contract...`);
  const contract = await deploy(contractName, parameters, deployer);
  console.log(`${contractName} deployed to ${contract.address}`);

  await verifyContract(contract.address, parameters);

  return <Type>contract;
}

export async function deployProxyAndVerify<Type extends Contract>(
  contractName: string,
  parameters: any[],
  deployer?: Signer
): Promise<Type> {
  if (deployer === undefined) {
    [deployer] = await ethers.getSigners();
  }

  console.log(`Deploying ${contractName} contract...`);
  const contract = await deployProxy(contractName, parameters, deployer);
  console.log(`${contractName} deployed to ${contract.address}`);

  const implementationAddress = await getImplementationAddress(ethers.provider, contract.address);
  await verifyContract(implementationAddress);

  return <Type>contract;
}

type FundFactory = {
  create(name: string): Promise<[InvestmentFund, InvestmentNFT]>;
};

type ProjectFactory = {
  create(
    name: string,
    symbol: string,
    start: number,
    period: VestingPeriod
  ): Promise<[Project, Token, PeriodicVesting]>;
};

type VestingPeriod = {
  allocation: BigNumber;
  duration: number;
  cadence: number;
  cliff: number;
};

const getFundFactory = (usdcAddress: string, stakingAddress: string, deployer: Signer): FundFactory => {
  const create = async (name: string): Promise<[InvestmentFund, InvestmentNFT]> => {
    const nft = (await deployProxyAndVerify(
      'InvestmentNFT',
      [`${name} Fund NFT`, 'CWI', env.OWNER_ACCOUNT],
      deployer
    )) as InvestmentNFT;

    const fund = (await deployProxyAndVerify(
      'InvestmentFund',
      [
        env.OWNER_ACCOUNT,
        name,
        usdcAddress,
        nft.address,
        stakingAddress,
        env.INVESTMENT_FUND_TREASURY_WALLET,
        env.INVESTMENT_FUND_MANAGEMENT_FEE,
        env.INVESTMENT_FUND_CAP
      ],
      deployer
    )) as InvestmentFund;
    return [fund, nft];
  };
  return { create };
};

const getProjectFactory = (owner: Wallet, swapperAddress: string, deployer: Signer): ProjectFactory => {
  const create = async (
    name: string,
    symbol: string,
    start: number,
    period: VestingPeriod
  ): Promise<[Project, Token, PeriodicVesting]> => {
    const project: Project = await deployProxyAndVerify('Project', [name, owner.address, swapperAddress], deployer);
    const token: Token = await deployProxyAndVerify('Token', [`${name} Token`, symbol], deployer);
    const vesting: PeriodicVesting = await deployProxyAndVerify(
      'PeriodicVesting',
      [token.address, project.address, start, [[period.allocation, period.duration, period.cadence, period.cliff]]],
      deployer
    );

    (await project.connect(owner).setVesting(vesting.address)).wait();

    return [project, token, vesting];
  };
  return { create };
};

async function main() {
  const SECONDS_IN_YEAR = /* 31536000 */ 3600;
  const ONE_YEAR = 1 * SECONDS_IN_YEAR;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const THREE_YEARS = 3 * SECONDS_IN_YEAR;
  const FOUR_YEARS = 4 * SECONDS_IN_YEAR;

  const tokenAllocation = toUsdc('259200');
  const durationInSeconds = 15552000; // 180 days
  const blockTimeInSeconds = 12;
  const start = 122132;
  const durationInBlocks = Math.floor(durationInSeconds / blockTimeInSeconds);
  const cadence = 1;
  const cliff = 0;

  console.log('Start setup');

  const provider = ethers.getDefaultProvider();
  const deployerPrivateKey = getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name);
  if (deployerPrivateKey === undefined) {
    throw Error('Invalid private key');
  }

  const [deployer] = await ethers.getSigners();
  const owner = new Wallet('f1a503f2394a2445abc84a65e6a4e28c4496b65b0c6e28a63ad8b924cb1b7232', provider);

  const usdc = await deployAndVerify('USDC', [], deployer);
  // const usdc = await ethers.getContractAt('USDC', '0xAe6B5B4168356694f0801FBdaB6562F1223ad2Cb');

  const wlth = await deployProxyAndVerify('Wlth', ['Common Wealth Token', 'WLTH', owner.address], deployer);
  // const wlth = await ethers.getContractAt('Wlth', '0x89cB38d7cb8F3cEdE1b46f407149CD69065A0Fc9');
  // await wlth.connect(deployer).transfer(owner.address, toWlth('1000000'))

  const fundRegistry = await deployProxyAndVerify('InvestmentFundRegistry', [owner.address], deployer);
  // const fundRegistry = await ethers.getContractAt(
  // 'InvestmentFundRegistry',
  // '0x54D974FcC7ffA01A5c85c7975DfBBa256409f29d'
  // );

  const quoter = await deployAndVerify('UniswapQuoter', [], deployer);
  // const quoter = await ethers.getContractAt('UniswapQuoterMock', '0xf5F2d9cda4Aa1816c1c69a0d78950a6BF8bC63C5');

  const staking = await deployProxyAndVerify(
    'StakingWlth',
    [
      owner.address,
      wlth.address,
      usdc.address,
      quoter.address,
      env.STAKING_TRANSACTION_FEE,
      env.STAKING_TREASURY_WALLET,
      env.STAKING_MAX_DISCOUNT,
      [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
      [5000, 3750, 3125, 2500]
    ],
    deployer
  );
  // const staking = await ethers.getContractAt('StakingWlth', '0x3c0eB714B6225f40f6672911C58A4E59d6790BC4');

  console.log('Setup investment funds');
  const fundFactory = getFundFactory(usdc.address, staking.address, deployer);
  const [metaverseFund, metaverseFundNft] = await fundFactory.create('Metaverse Fund');
  // const [metaverseFund, metaverseFundNft] = await Promise.all([
  //   await ethers.getContractAt('InvestmentFund', '0xcc8B58E376609beeC7aA27e6566A7d229B4Af8BC'),
  //   await ethers.getContractAt('InvestmentNFT', '0xDADF316D7de322069329E840932621e1b6ecC007')
  // ]);

  const [evergreenFund, evergreenFundNft] = await fundFactory.create('Evergreen Fund');
  // const [evergreenFund, evergreenFundNft] = await Promise.all([
  //   await ethers.getContractAt('InvestmentFund', '0xD542a3384ecE8850D2D0Da011540360382895285'),
  //   await ethers.getContractAt('InvestmentNFT', '0x041EF9b489Cc43AE21af45832A3D2FC7fe2bb05a')
  // ]);

  const [zeroKnowledgeFund, zeroKnowledgeFundNft] = await fundFactory.create('Zero Knowledge Fund');
  const [arbitrumEcosystemFund, arbitrumEcosystemFundNft] = await fundFactory.create('Arbitrum Ecosystem Fund');
  const [zkSyncFund, zkSyncFundNft] = await fundFactory.create('ZK Sync Fund');

  console.log('Setting funds minter roles in investment NFTs');
  await Promise.all([
    (await metaverseFundNft.connect(owner).addMinter(metaverseFund.address)).wait(),
    (await evergreenFundNft.connect(owner).addMinter(evergreenFund.address)).wait(),
    (await zeroKnowledgeFundNft.connect(owner).addMinter(zeroKnowledgeFund.address)).wait(),
    (await arbitrumEcosystemFundNft.connect(owner).addMinter(arbitrumEcosystemFund.address)).wait(),
    (await zkSyncFundNft.connect(owner).addMinter(zkSyncFund.address)).wait()
  ]);

  console.log('Registering funds in staking contract');
  await Promise.all([
    (await staking.connect(owner).registerFund(metaverseFund.address)).wait(),
    (await staking.connect(owner).registerFund(evergreenFund.address)).wait(),
    (await staking.connect(owner).registerFund(zeroKnowledgeFund.address)).wait(),
    (await staking.connect(owner).registerFund(arbitrumEcosystemFund.address)).wait(),
    (await staking.connect(owner).registerFund(zkSyncFund.address)).wait()
  ]);

  console.log('Adding funds to registry');
  await Promise.all([
    (await fundRegistry.connect(owner).addFund(metaverseFund.address)).wait(),
    (await fundRegistry.connect(owner).addFund(evergreenFund.address)).wait(),
    (await fundRegistry.connect(owner).addFund(zeroKnowledgeFund.address)).wait(),
    (await fundRegistry.connect(owner).addFund(arbitrumEcosystemFund.address)).wait(),
    (await fundRegistry.connect(owner).addFund(zkSyncFund.address)).wait()
  ]);

  console.log('Setup projects');
  const swapper = await deployAndVerify('UniswapSwapper', [], deployer);
  // const swapper = await ethers.getContractAt('UniswapSwapperMock', '0x7067F7C9Bd063E3AE77d603fE592f19c36A9A6A6');

  const projectFactory = getProjectFactory(owner, swapper.address, deployer);
  const period = {
    allocation: tokenAllocation,
    duration: durationInBlocks,
    cadence,
    cliff
  };

  const [illuviumProject, illuviumToken, illuviumVesting] = await projectFactory.create(
    'Illuvium',
    'ILV',
    start,
    period
  );
  // const [illuviumProject, illuviumToken, illuviumVesting] = await Promise.all([
  //   await ethers.getContractAt('Project', '0x55B588fA25c1A9e01EB13E7ea2e8d26cC5B926f5'),
  //   await ethers.getContractAt('ProjectToken', '0x4aeD32Ed82443CB05c59b4115C43997658ee1b77'),
  //   await ethers.getContractAt('PeriodicVesting', '0x199EaF83E7Cc84757089e5858ec24BAC38546ED7')
  // ]);

  const [starAtlasProject, starAtlasToken, starAtlasVesting] = await projectFactory.create(
    'Star Atlas',
    'ATLAS',
    start,
    period
  );

  const [arbitrumProject, arbitrumToken, arbitrumVesting] = await projectFactory.create(
    'Arbitrum',
    'ARB',
    start,
    period
  );
  // const [arbitrumProject, arbitrumToken, arbitrumVesting] = await Promise.all([
  //   await ethers.getContractAt('Project', '0xB28E4A15996b85d4288562938a57E21001c34c18'),
  //   await ethers.getContractAt('ProjectToken', '0xC85a24E1B37f1d83187DaFACB68d95464dd67F3A'),
  //   await ethers.getContractAt('PeriodicVesting', '0x4FE1Ea2186184b6D5A7a32A11D78DbD7A1e9216A')
  // ]);

  const [starkwareProject, starkwareToken, starkwareVesting] = await projectFactory.create(
    'Starkware',
    'STARK',
    start,
    period
  );
  const [radiantProject, radiantToken, radiantVesting] = await projectFactory.create('Radiant', 'RXD', start, period);
  const [wooNetworkProject, wooNetworkToken, wooNetworkVesting] = await projectFactory.create(
    'Woo Network',
    'WOO',
    start,
    period
  );

  console.log('Adding projects to funds');
  await Promise.all([
    (await metaverseFund.connect(owner).addProject(illuviumProject.address)).wait(),
    (await metaverseFund.connect(owner).addProject(starAtlasProject.address)).wait(),
    (await evergreenFund.connect(owner).addProject(arbitrumProject.address)).wait(),
    (await zeroKnowledgeFund.connect(owner).addProject(starkwareProject.address)).wait(),
    (await arbitrumEcosystemFund.connect(owner).addProject(radiantProject.address)).wait(),
    (await zkSyncFund.connect(owner).addProject(wooNetworkProject.address)).wait()
  ]);

  console.log('Done');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
