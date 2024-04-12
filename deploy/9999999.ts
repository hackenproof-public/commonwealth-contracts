import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getDeploymentConfig } from '../utils/config';
import { upgrade } from '../utils/deployment';

const deployStakingGenNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'royaltyAccount', value: deploymentCofing.genesisNftRoyaltyAccount },
    { name: 'royaltyValue', value: 650 },
    { name: 'contractUri', value: 'ipfs://QmecFbuBURVP8fF9phJztSaaSUkPRNuhpEYsQtPRKQPxnc' }
  ];

  // await deploy(hre, 'GenNFT', parameters, true, true);

  await upgrade(hre, 'GenNFTV2', '0xE495505335096e833D0cF23F2748C12746F67165');
};

export default deployStakingGenNFTVesting;
deployStakingGenNFTVesting.tags = ['tge', 'genTest', 'all'];
