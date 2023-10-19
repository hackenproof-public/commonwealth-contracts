import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { InvestmentFund } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployProject: DeployFunction = async ({ network }) => {
  const deploymentConfig = getDeploymentConfig();

  const projectName = undefined;
  const fundAddress = undefined;
  const tokenName = undefined;
  const tokenSymbol = undefined;
  const fundsAllocation = undefined;

  if (!projectName || !fundAddress || !fundsAllocation || !tokenName || !tokenSymbol) {
    throw Error(
      'Please configure projectName, fundAddress, fundsAllocation, tokenName and tokenSymbol in the Project deployment script.'
    );
  }

  const swapper = await getContractAddress(network.config.chainId!, 'UniswapSwapper');
  const usdc = await getContractAddress(network.config.chainId!, 'USDC');

  const projectParameters = [
    { name: 'name', value: projectName },
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'token', value: usdc },
    { name: 'swapper', value: swapper },
    { name: 'investmentFund', value: fundAddress },
    { name: 'fundsAllocation', value: fundsAllocation }
  ];

  const project = await deploy('Project', projectParameters, true, false);

  if (!project) {
    throw Error('Project deployment failed');
  }

  //Temporary until there is a real vesting
  const beneficiary = deploymentConfig.ownerAccount;
  const tokenAllocation = ethers.utils.parseUnits('259200', 6);
  const durationInSeconds = 15552000; // 180 days
  const blockTimeInSeconds = 12;
  const durationInBlocks = Math.floor(durationInSeconds / blockTimeInSeconds);
  const cadence = 1;
  const cliff = 0;

  const tokenParameters = [
    { name: 'name', value: tokenName },
    { name: 'symbol', value: tokenSymbol }
  ];

  const token = await deploy('Token', tokenParameters, true, false);

  if (!token) {
    throw Error('Token deployment failed');
  }

  const vestingParameters = [
    { name: 'token', value: token.address },
    { name: 'beneficiary', value: beneficiary },
    { name: 'startBlock', value: await ethers.provider.getBlockNumber() },
    { name: 'periods', value: [[tokenAllocation, durationInBlocks, cadence, cliff]] }
  ];

  const vesting = await deploy('PeriodicVesting', vestingParameters, true, false);

  if (!vesting) {
    throw Error('Vesting deployment failed');
  }

  await setProjectVesting(project.address, vesting.address);
  await addProjectToFund(project.address, fundAddress);
};

export default deployProject;
deployProject.tags = ['project'];

async function setProjectVesting(projectAddress: string, vestingAddress: string) {
  console.log(`Setting vesting: ${vestingAddress} in Project: ${projectAddress}`);
  const project = await ethers.getContractAt('Project', projectAddress);
  await project.setVesting(vestingAddress);
  console.log('Vesting successfully set in Project');
}

async function addProjectToFund(projectAddress: string, fundAddress: string) {
  console.log(`Adding Project: ${projectAddress} to Fund: ${fundAddress}`);
  const fund: InvestmentFund = (await ethers.getContractAt('InvestmentFund', fundAddress)) as InvestmentFund;
  await fund.addProject(projectAddress);
  console.log('Project successfully added to Fund');
}
