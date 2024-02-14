import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const genNFTseries1Mirror = await getContractAddress(network.config.chainId!, 'GenesisNFTV1mirror');
  const genNFTseries2Mirror = await getContractAddress(network.config.chainId!, 'GenesisNFTV2mirror');

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'genNFTseries1', value: genNFTseries1Mirror },
    { name: 'genNFTseries2', value: genNFTseries2Mirror },
    { name: 'wlth', value: wlth },
    { name: 'duration', value: deploymentCofing.nftVestingDuration },
    { name: 'cadence', value: deploymentCofing.nftVestingCadence },
    { name: 'vestingStartTimestamp', value: deploymentCofing.nftVestingStartTimestamp },
    { name: 'allocation', value: deploymentCofing.genesisNftVestingAllocation },
    {
      name: 'emergencyWithdrawalUnlockTimestamp',
      value: deploymentCofing.genesisNftVestingEmergencyWithdrawalUnlockTimestamp
    }
  ];

  await deploy(hre, 'GenesisNFTVesting', parameters);
};

export default deployGenesisNFTVesting;
deployGenesisNFTVesting.tags = ['tge', 'genesisNFTVesting', 'all'];
