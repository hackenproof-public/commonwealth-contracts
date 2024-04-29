import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployUniswapWlthSwapper: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();

  const parameters = [
    { name: '_owner', value: deploymentConfig.ownerAccount },
    { name: '_swapRouter', value: deploymentConfig.uniswapSwapRouterV3Address } // SwapRouter02
  ];

  await deploy(hre, 'UniswapSwapper', parameters, true, false);
};

export default deployUniswapWlthSwapper;
deployUniswapWlthSwapper.tags = ['all', 'uniswapSwapper'];
