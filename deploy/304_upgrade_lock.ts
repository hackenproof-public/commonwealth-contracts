import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { upgrade } from '../utils/deployment';

const upgradeGenesisNFTLock: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;

  const staking = await getContractAddress(network.config.chainId!, 'GenesisNFTLock');

  await upgrade(hre, 'GenesisNFTLock', staking);
};

export default upgradeGenesisNFTLock;
upgradeGenesisNFTLock.tags = ['upgrade', 'upgradeGenesisNFTLock'];
