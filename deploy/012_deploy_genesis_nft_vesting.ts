import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNFTVesting: DeployFunction = async () => {
  const deploymentCofing = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const stakingGenesisNft = await getContractAddress(network.config.chainId!, 'StakingGenesisNFT');
  const genNFTseries1 = await getContractAddress(network.config.chainId!, 'GenesisNFTV1');
  const genNFTseries2 = await getContractAddress(network.config.chainId!, 'GenesisNFTV2');

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'wlth', value: wlth },
    { name: 'duration', value: deploymentCofing.nftVestingDuration },
    { name: 'cadence', value: deploymentCofing.nftVestingCadence },
    { name: 'vestingStartTimestamp', value: deploymentCofing.nftVestingStartTimestamp },
    { name: 'genNFTseries1', value: genNFTseries1 },
    { name: 'genNFTseries2', value: genNFTseries2 },
    { name: 'stakingGenNFT', value: stakingGenesisNft }
  ];

  await deploy('GenesisNFTVesting', parameters);
};

export default deployGenesisNFTVesting;
deployGenesisNFTVesting.tags = ['tge', 'all'];
