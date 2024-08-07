import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { upgrade } from '../utils/deployment';

const upgradeMarketplace: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const marketplace = await getContractAddress(network.config.chainId!, 'Marketplace');

  await upgrade(hre, 'Marketplace', marketplace);
};

export default upgradeMarketplace;
upgradeMarketplace.tags = ['upgradeMarketplace'];
