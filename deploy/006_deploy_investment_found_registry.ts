import { DeployFunction } from 'hardhat-deploy/dist/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployInvestmentFundRegistry: DeployFunction = async ({ network }) => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [{ name: 'owner', value: deploymentCofing.ownerAccount }];

  await deploy('InvestmentFundRegistry', parameters, true);
};

export default deployInvestmentFundRegistry;
deployInvestmentFundRegistry.tags = ['investmentFundRegistry', 'all', 'beta'];
