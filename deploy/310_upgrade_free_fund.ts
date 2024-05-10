import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { upgrade } from '../utils/deployment';

const upgradeFreeFund: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const freeFundAddress = undefined;

  if (freeFundAddress === undefined) {
    throw Error('Please configure free fund address in the upgrade script.');
  }

  await upgrade(hre, 'FreeFund', freeFundAddress);
};

export default upgradeFreeFund;
upgradeFreeFund.tags = ['upgrade', 'upgradeFreeFund'];
