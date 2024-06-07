import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { upgrade } from '../utils/deployment';

const upgradeWlthBonusStaking: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const marketingAddress = '0xcA8310e5fC441f9c7e575C64a8d992F455e6b7BF';

  await upgrade(hre, 'WhitelistedVesting', marketingAddress);
};

export default upgradeWlthBonusStaking;
upgradeWlthBonusStaking.tags = ['upgradeMarketing'];
