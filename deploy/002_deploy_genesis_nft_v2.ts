import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNftV2: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: 'name', value: deploymentCofing.genesisNftS2Name },
    { name: 'symbol', value: deploymentCofing.genesisNFTS2Symbol },
    { name: 'series', value: deploymentCofing.genesisNftV2Series },
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'royaltyAccount', value: deploymentCofing.genesisNftRoyaltyAccount },
    { name: 'royaltyValue', value: deploymentCofing.genesisNftRoyalty },
    { name: 'tokenUri', value: deploymentCofing.genesisNftV2TokenUri }
  ];

  await deploy(hre, 'GenesisNFT', parameters, true, true, 'GenesisNFTV2');
};

export default deployGenesisNftV2;
deployGenesisNftV2.tags = ['genesisNFTV2', 'all', 'beta'];
