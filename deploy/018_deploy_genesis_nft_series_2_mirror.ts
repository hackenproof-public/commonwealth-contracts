import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { utils } from 'zksync-web3';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'governor', value: utils.applyL1ToL2Alias('') },
    { name: 'tokensIds', value: [] },
    { name: 'tokensOwners', value: [] },
    { name: 'name', value: deploymentCofing.genesisNftName },
    { name: 'symbol', value: deploymentCofing.genesisNFTSymbol }
  ];

  await deploy(hre, 'GenesisNFTmirror', parameters, true, true, 'GenesisNFTV2mirror');
};

export default deployGenesisNFTVesting;
deployGenesisNFTVesting.tags = ['tge', 'genesisNftV2Mirror', 'all'];
