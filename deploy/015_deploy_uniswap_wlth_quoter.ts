import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployUniswapWlthQuoter: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();

  const parameters = [{ name: 'owner', value: deploymentConfig.ownerAccount }];

  await deploy(hre, 'UniswapWlthQuoter', parameters, true, false);
};

export default deployUniswapWlthQuoter;
deployUniswapWlthQuoter.tags = ['all', 'uniswapWlthQuoter'];
