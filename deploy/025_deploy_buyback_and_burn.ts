import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployBuybackAndBurn: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const usdc = await getContractAddress(network.config.chainId!, 'USDC');
  const swapper = await getContractAddress(network.config.chainId!, 'UniswapSwapper');

  const parameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'wlth', value: wlth },
    { name: 'usdc', value: usdc },
    { name: 'swapper', value: swapper },
    { name: 'pool', value: deploymentConfig.uniswapWlthUsdcPoolAddress },
    { name: 'minimumBuyback', value: deploymentConfig.minimumBuyback }
  ];

  await deploy(hre, 'BuybackAndBurn', parameters, true);
};

export default deployBuybackAndBurn;
deployBuybackAndBurn.tags = ['buybackAndBurn', 'all'];
