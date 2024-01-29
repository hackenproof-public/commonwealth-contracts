import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { utils } from 'zksync-web3';
import { l2Tol1 } from '../helper-hardhat-config';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNFT2Mirror: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();
  const lockContract = await getContractAddress(l2Tol1[network.config.chainId!].chainId, 'GenesisNFTLock');

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'governor', value: utils.applyL1ToL2Alias(lockContract) },
    { name: 'name', value: deploymentCofing.genesisNftName },
    { name: 'symbol', value: deploymentCofing.genesisNFTSymbol }
  ];

  await deploy(hre, 'GenesisNFTMirror', parameters, true, true, 'GenesisNFTV2Mirror');
};

export default deployGenesisNFT2Mirror;
deployGenesisNFT2Mirror.tags = ['tge', 'genesisNftV2Mirror', 'all'];
