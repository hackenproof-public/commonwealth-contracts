import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployUniswapWlthSwapper: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();

  const parameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'swapRouter', value: deploymentConfig.uniswapSwapRouterV3Address } // SwapRouter02
  ];

  await deploy(hre, 'UniswapSwapper', parameters, true);
};

export default deployUniswapWlthSwapper;
deployUniswapWlthSwapper.tags = ['all', 'uniswapSwapper'];
