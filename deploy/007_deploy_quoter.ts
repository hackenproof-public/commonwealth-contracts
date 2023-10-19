import { DeployFunction } from 'hardhat-deploy/dist/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployQuater: DeployFunction = async () => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: 'quoter', value: deploymentCofing.uniswapQuaterV2Address },
    { name: 'feeTier', value: deploymentCofing.zeroPointThreeFeeTier }
  ];
  await deploy('UniswapQuoter', parameters, true);
};

export default deployQuater;
deployQuater.tags = ['uniswapQuater', 'all', 'beta'];
