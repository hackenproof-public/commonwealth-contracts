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
    beneficiary: '0xdE70B8BC5215BdF03f839BB8cD0F639D4E3E2881',
    allocation: 139973434,
    duration: ONE_MONTH * 17,
    cadence: ONE_MONTH,
    vestingStartTimestamp: 0 //TODO to include 1 month cliff add ONE_MONTH
  };

  const parameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'wlth', value: wlth },
    { name: 'beneficiary', value: vestingParameters.beneficiary },
    { name: 'allocation', value: toWlth(vestingParameters.allocation.toString()) },
    { name: 'duration', value: vestingParameters.duration },
    { name: 'cadence', value: vestingParameters.cadence },
    { name: 'leftoversUnlockDelay', value: deploymentConfig.genesisNftVestingLeftoversUnlockDelay },
    { name: 'vestingStartTimestamp', value: vestingParameters.vestingStartTimestamp }
  ];

  await deploy(hre, 'SimpleVesting', parameters);
};

export default deployGenesisNFTVesting;
deployGenesisNFTVesting.tags = ['tge', 'treasurySetup', 'all'];
