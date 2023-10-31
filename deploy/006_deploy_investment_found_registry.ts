import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployInvestmentFundRegistry: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [{ name: 'owner', value: deploymentCofing.ownerAccount }];

  await deploy(hre, 'InvestmentFundRegistry', parameters, true);
};

export default deployInvestmentFundRegistry;
deployInvestmentFundRegistry.tags = ['investmentFundRegistry', 'all', 'beta'];
