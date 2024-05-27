import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';
import { ethers } from 'hardhat';

const deployUniswapWlthPriceOracle: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;
  const deploymentConfig = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const usdc = await getContractAddress(network.config.chainId!, 'USDC');

  const parameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'wlth', value: wlth },
    { name: 'usdc', value: usdc },
    { name: 'pool', value: ethers.constants.AddressZero },
    { name: 'observationTime', value: deploymentConfig.poolObservationTime }
  ];

  await deploy(hre, 'UniswapWlthPriceOracle', parameters, true);
};

export default deployUniswapWlthPriceOracle;
deployUniswapWlthPriceOracle.tags = ['all', 'uniswapWlthPriceOracle'];
