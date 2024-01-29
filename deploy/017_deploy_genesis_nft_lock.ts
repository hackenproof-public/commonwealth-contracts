import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNftLock: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const nftV1 = await getContractAddress(network.config.chainId!, 'GenesisNFTV1');
  const nftV2 = await getContractAddress(network.config.chainId!, 'GenesisNFTV2');
  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'series1Nft', value: nftV1 },
    { name: 'series2Nft', value: nftV2 },
    { name: 'zkSyncGasPerPubdataLimit', value: deploymentCofing.zkSyncGasPerPubdataLimit }
  ];

  await deploy(hre, 'GenesisNFTLock', parameters, true);
};

export default deployGenesisNftLock;
deployGenesisNftLock.tags = ['tge', 'genesisNftLock', 'all'];
