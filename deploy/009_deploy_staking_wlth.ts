import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployStakingWlth: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;
  const deploymentCofing = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const usdc = await getContractAddress(network.config.chainId!, 'USDC');
  const wlthPriceOracle = await getContractAddress(network.config.chainId!, 'UniswapWlthPriceOracle');

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'token', value: wlth },
    { name: 'usdc', value: usdc },
    { name: 'uniswapWlthPrice', value: wlthPriceOracle },
    { name: 'fee', value: deploymentCofing.stakingTransactionFee },
    { name: 'secondarySalesWallet', value: deploymentCofing.secondarySalesWallet },
    { name: 'maxDiscount', value: deploymentCofing.maxDiscount },
    { name: 'periods', value: deploymentCofing.periods },
    { name: 'coefficients', value: deploymentCofing.coefficients }
  ];

  await deploy(hre, 'StakingWlth', parameters, true);
};

export default deployStakingWlth;
deployStakingWlth.tags = ['wlthStaking', 'all', 'beta'];
