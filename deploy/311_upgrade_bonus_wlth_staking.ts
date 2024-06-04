import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { upgrade } from '../utils/deployment';

const upgradeWlthBonusStaking: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const wlthBonusStakingAddress = await getContractAddress(network.config.chainId!, 'WlthBonusStaking');

  await upgrade(hre, 'WlthBonusStaking', wlthBonusStakingAddress);
};

export default upgradeWlthBonusStaking;
upgradeWlthBonusStaking.tags = ['upgradeWlthBonusStaking'];
