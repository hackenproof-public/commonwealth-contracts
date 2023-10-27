import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNFTVesting: DeployFunction = async () => {
  const deploymentCofing = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const stakingGenesisNft = await getContractAddress(network.config.chainId!, 'StakingGenesisNFT');

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'wlth', value: wlth },
    { name: 'allocation', value: deploymentCofing.genesisNftStakingAllocation },
    { name: 'vestingStartTimestamp', value: deploymentCofing.nftVestingStartTimestamp },
    { name: 'stakingGenNFT', value: stakingGenesisNft }
  ];

  await deploy('StakingGenNFTVesting', parameters);
};

export default deployGenesisNFTVesting;
deployGenesisNFTVesting.tags = ['tge', 'all'];
