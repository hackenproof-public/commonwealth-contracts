import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { upgradeContract } from '../utils/deployment';

const deployWlth: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: 'name', value: deploymentCofing.wlthName },
    { name: 'symbol', value: deploymentCofing.wlthSymbol },
    { name: 'owner', value: deploymentCofing.ownerAccount }
  ];

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');

  await upgradeContract('Wlth', wlth);
};

export default deployWlth;
deployWlth.tags = ['upgrade', 'upgrade', 'upgradeWlth'];
