import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { updateAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployUsdt: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;
  const deploymentCofing = getDeploymentConfig();

  // Shouldn't be uploaded to the mainnet
  if (network.config.chainId !== 1) {
    await deploy(hre, 'USDT', [], false);
  } else {
    await updateAddress(network.config.chainId, 'USDT', deploymentCofing.usdt!);
  }
};

export default deployUsdt;
deployUsdt.tags = ['all', 'usdt', 'beta'];
