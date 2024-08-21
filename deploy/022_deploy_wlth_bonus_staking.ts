import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployWlthBonusStaking: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');

  const parameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'wlth', value: wlth },
    { name: 'secondarySalesWallet', value: deploymentConfig.secondarySalesWallet },
    { name: 'stakingStartTimestamp', value: deploymentConfig.bonusStakingStartTimestamp },
    { name: 'stakingDuration', value: deploymentConfig.bonusStakingDuration },
    { name: 'totalReward', value: deploymentConfig.bonusStakingTotalReward }
  ];

  await deploy(hre, 'WlthBonusStaking', parameters, true);
};

export default deployWlthBonusStaking;
deployWlthBonusStaking.tags = ['wlthBonusStaking', 'all'];
