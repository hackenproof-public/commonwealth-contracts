import { DeployFunction } from 'hardhat-deploy/dist/types';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNftV1: DeployFunction = async () => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: 'name', value: deploymentCofing.genesisNFTSymbol },
    { name: 'symbol', value: deploymentCofing.genesisNFTSymbol },
    { name: 'series', value: deploymentCofing.genesisNftV1Series },
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'royaltyAccount', value: deploymentCofing.genesisNftRoyaltyAccount },
    { name: 'royaltyValue', value: deploymentCofing.genesisNftRoyalty },
    { name: 'tokenUri', value: deploymentCofing.genesisNftV1TokenUri }
  ];

  await deploy('GenesisNFTV1', parameters, true);
};

export default deployGenesisNftV1;
deployGenesisNftV1.tags = ['genesisNFTV1', 'genesisNFT', 'all', 'beta'];
