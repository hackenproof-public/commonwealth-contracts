import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { upgrade } from '../utils/deployment';

const deployWlth: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  await upgrade(hre, 'UniswapWlthQuoter', '0x7A4068A84c651938EBa4Bc081159f28047ebCbA2');
};

export default deployWlth;
deployWlth.tags = ['upgrade', 'upgradeUniswapWlthQuoter'];
