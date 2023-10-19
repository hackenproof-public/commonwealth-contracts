import { DeployFunction } from 'hardhat-deploy/dist/types';
import { updateAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployUsdc: DeployFunction = async ({ network }) => {
  const deploymentCofing = getDeploymentConfig();

  // Shouldn't be uploaded to the mainnet
  if (network.config.chainId !== 1) {
    await deploy('USDC', [], false);
  } else {
    await updateAddress(network.config.chainId, 'USDC', deploymentCofing.usdc!);
  }
};

export default deployUsdc;
deployUsdc.tags = ['all', 'usdc', 'beta'];
