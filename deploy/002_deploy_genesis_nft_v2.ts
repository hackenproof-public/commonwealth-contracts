import { DeployFunction } from 'hardhat-deploy/dist/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNftV2: DeployFunction = async () => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: 'name', value: deploymentCofing.genesisNFTSymbol },
    { name: 'symbol', value: deploymentCofing.genesisNFTSymbol },
    { name: 'series', value: deploymentCofing.genesisNftV2Series },
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'royaltyAccount', value: deploymentCofing.genesisNftRoyaltyAccount },
    { name: 'royaltyValue', value: deploymentCofing.genesisNftRoyalty },
    { name: 'tokenUri', value: deploymentCofing.genesisNftV2TokenUri }
  ];

  await deploy('GenesisNFTV2', parameters, true);
};

export default deployGenesisNftV2;
deployGenesisNftV2.tags = ['genesisNFTV2', 'genesisNFT', 'all', 'beta'];
