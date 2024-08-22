import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const genNFTseries1 = await getContractAddress(network.config.chainId!, 'GenesisNFTV1');
  const genNFTseries2 = await getContractAddress(network.config.chainId!, 'GenesisNFTV2');

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'genNFTseries1', value: genNFTseries1 },
    { name: 'genNFTseries2', value: genNFTseries2 },
    { name: 'wlth', value: wlth },
    { name: 'secondarySalesWallet', value: deploymentCofing.secondarySalesWallet },
    { name: 'duration', value: deploymentCofing.nftVestingDuration },
    { name: 'cadence', value: deploymentCofing.nftVestingCadence },
    { name: 'allocation', value: deploymentCofing.genesisNftVestingAllocation },
    {
      name: 'leftoversUnlockDelay',
      value: deploymentCofing.genesisNftVestingLeftoversUnlockDelay
    },
    { name: 'vestingStartTimestamp', value: deploymentCofing.genesisNftVestingStartTimestamp }
  ];

  await deploy(hre, 'GenesisNFTVesting', parameters);
};

export default deployGenesisNFTVesting;
deployGenesisNFTVesting.tags = ['tge', 'genesisNFTVesting', 'all'];
