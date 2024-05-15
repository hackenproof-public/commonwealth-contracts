import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { toWlth } from '../test/utils';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();
  const ONE_MONTH = 2592000;
  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');

  // 1 month cliff, 17 month linear vest
  const vestingParameters = {
    beneficiary: deploymentConfig.communityFundWallet,
    allocation: 150000000,
    duration: ONE_MONTH * 17,
    cadence: ONE_MONTH,
    vestingStartTimestamp: Math.floor(Date.now() / 1000) + ONE_MONTH // 1 month cliff
  };

  const parameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'wlth', value: wlth },
    { name: 'beneficiary', value: vestingParameters.beneficiary },
    { name: 'allocation', value: toWlth(vestingParameters.allocation.toString()) },
    { name: 'duration', value: vestingParameters.duration },
    { name: 'cadence', value: vestingParameters.cadence },
    { name: 'leftoversUnlockDelay', value: deploymentConfig.genesisNftVestingLeftoversUnlockDelay },
    { name: 'vestingStartTimestamp', value: deploymentConfig.genesisNftVestingAllocation }
  ];

  await deploy(hre, 'SimpleVesting', parameters);
};

export default deployGenesisNFTVesting;
deployGenesisNFTVesting.tags = ['tge', 'treasurySetup', 'all'];
