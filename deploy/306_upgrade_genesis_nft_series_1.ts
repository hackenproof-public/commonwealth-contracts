import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { upgrade } from '../utils/deployment';

const upgradeGenesisNFTLock: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;

  const genesisNft = await getContractAddress(network.config.chainId!, 'GenesisNFTV1');

  await upgrade(hre, 'GenesisNFT', genesisNft);
};

export default upgradeGenesisNFTLock;
upgradeGenesisNFTLock.tags = ['upgradeGenesisNftSeries1'];
