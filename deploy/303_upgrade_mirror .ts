import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { upgrade } from '../utils/deployment';

const upgradeGenesisNftMirror: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;

  const staking = await getContractAddress(network.config.chainId!, 'GenesisNFTV1Mirror');

  await upgrade(hre, 'GenesisNFTMirror', staking);
};

export default upgradeGenesisNftMirror;
upgradeGenesisNftMirror.tags = ['upgrade', 'upgradeGenesisNftMirror'];
