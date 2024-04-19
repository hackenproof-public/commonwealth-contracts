import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployWlth: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: '_name', value: deploymentCofing.wlthName },
    { name: '_symbol', value: deploymentCofing.wlthSymbol },
    { name: '_wallet', value: deploymentCofing.wlthWallet }
  ];

  await deploy(hre, 'Wlth', parameters, false);
};

export default deployWlth;
deployWlth.tags = ['wlth', 'all', 'beta'];
