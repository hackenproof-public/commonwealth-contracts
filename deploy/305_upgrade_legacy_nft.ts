import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { upgrade } from '../utils/deployment';

const upgradeGenesisNFTLock: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;

  const legacyAddress = '';

  await upgrade(hre, 'GenNFTV3', legacyAddress);
};

export default upgradeGenesisNFTLock;
upgradeGenesisNFTLock.tags = ['upgradeLegacyNft'];
