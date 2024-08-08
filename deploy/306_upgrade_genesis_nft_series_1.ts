import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { upgrade } from '../utils/deployment';

const upgradeGenesisNFTLock: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;

  //const genesisNft = await getContractAddress(network.config.chainId!, 'GenesisNFTV1');
  //const genesisNft = "0x51dA71fCFe737115754aCFBa9A20d4C98aB9c900";
  const genesisNft = "0x9Ba8d198B0450Ee50A1f55d6eD7E904e171A0408";

  await upgrade(hre, 'GenesisNFT', genesisNft);
};

export default upgradeGenesisNFTLock;
upgradeGenesisNFTLock.tags = ['upgradeGenesisNftSeries1'];
