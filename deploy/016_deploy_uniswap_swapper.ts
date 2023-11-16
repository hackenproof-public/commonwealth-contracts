import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployUniswapWlthSwapper: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();

  const parameters = [{ name: 'owner', value: deploymentConfig.ownerAccount }];

  await deploy(hre, 'UniswapWlthSwapper', parameters, true, false);
};

export default deployUniswapWlthSwapper;
deployUniswapWlthSwapper.tags = ['all', 'uniswapWlthSwapper'];
