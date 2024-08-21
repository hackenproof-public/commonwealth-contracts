import { NonceManager } from '@ethersproject/experimental';
import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { InvestmentFund } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const wlthFund: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();

  const usdcAddress = await getContractAddress(network.config.chainId!, 'USDC');
  const wlthAddress = await getContractAddress(network.config.chainId!, 'Wlth');

  const parameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'wlth', value: wlthAddress },
    { name: 'usdc', value: usdcAddress },
    { name: 'secondarySalesWallet', value: deploymentConfig.secondarySalesWallet }
  ];

  await deploy(hre, 'WlthFund', parameters, true, true, 'WlthFund');

  console.log('Done');
};

export default wlthFund;
wlthFund.tags = ['wlthFund', 'all'];
