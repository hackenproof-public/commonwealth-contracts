import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deploySwapper: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'swapRouter', value: deploymentCofing.uniswapSwapRouterV2Address },
    { name: 'feeTier', value: deploymentCofing.zeroPointThreeFeeTier }
  ];

  await deploy(hre, 'UniswapSwapper', parameters, true);
};

export default deploySwapper;
deploySwapper.tags = ['uniswapSwapper', 'all', 'beta'];
