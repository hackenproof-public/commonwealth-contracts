import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { upgrade } from '../utils/deployment';

const upgradeStakingWlth: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;

  const staking = await getContractAddress(network.config.chainId!, 'StakingWlth');

  await upgrade(hre, 'StakingWlth', staking);
};

export default upgradeStakingWlth;
upgradeStakingWlth.tags = ['upgrade', 'upgradeStakingWlth'];
