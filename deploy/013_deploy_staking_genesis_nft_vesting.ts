import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployStakingGenNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'wlth', value: wlth },
    { name: 'allocation', value: deploymentCofing.genesisNftStakingAllocation },
    { name: 'distributionStartTimestamp', value: deploymentCofing.nftVestingStartTimestamp }
  ];

  await deploy(hre, 'StakingGenesisNFTVesting', parameters);
};

export default deployStakingGenNFTVesting;
deployStakingGenNFTVesting.tags = ['tge', 'stakingGenesisNFTVesting', 'all'];
