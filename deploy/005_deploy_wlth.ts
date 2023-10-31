import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployWlth: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: 'name', value: deploymentCofing.wlthName },
    { name: 'symbol', value: deploymentCofing.wlthSymbol },
    { name: 'owner', value: deploymentCofing.ownerAccount }
  ];

  await deploy(hre, 'Wlth', parameters, true);
};

export default deployWlth;
deployWlth.tags = ['wlth', 'all', 'beta'];