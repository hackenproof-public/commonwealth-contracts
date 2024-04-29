import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployUniswapWlthQuoter: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;
  const deploymentConfig = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const usdc = await getContractAddress(network.config.chainId!, 'USDC');

  const parameters = [
    { name: '_owner', value: deploymentConfig.ownerAccount },
    { name: '_wlth', value: wlth },
    { name: '_usdc', value: usdc },
    { name: '_pool', value: deploymentConfig.uniswapWlthUsdcPoolAddress }
  ];

  await deploy(hre, 'UniswapWlthPrice', parameters, true);
};

export default deployUniswapWlthQuoter;
deployUniswapWlthQuoter.tags = ['all', 'UniswapWlthPrice'];
