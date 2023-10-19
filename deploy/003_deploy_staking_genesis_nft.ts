import { constants } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployStakingGenesisNft: DeployFunction = async ({ network, deployments }) => {
  const deploymentCofing = getDeploymentConfig();

  const genesisNFTV1 = await getContractAddress(network.config.chainId!, 'GenesisNFTV1');
  const genesisNFTV2 = await getContractAddress(network.config.chainId!, 'GenesisNFTV2');

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'finalTimestamp_', value: constants.MaxUint256 },
    { name: 'smallNft_', value: genesisNFTV2 },
    { name: 'largeNft_', value: genesisNFTV1 },
    { name: 'rewardPeriod_', value: deploymentCofing.stakingNFTRewardPerios }
  ];

  const params = [];
  await deploy('StakingGenesisNFT', parameters, true);
};

export default deployStakingGenesisNft;
deployStakingGenesisNft.tags = ['genesisNftStaking', 'genesisNft', 'all', 'beta'];
