import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { toWlth } from '../test/utils';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployGenesisNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const tokenReleaseDistribution = [
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('6960000'),
    toWlth('12180000'),
    toWlth('17400000'),
    toWlth('22620000'),
    toWlth('27840000'),
    toWlth('33060000'),
    toWlth('38280000'),
    toWlth('43500000'),
    toWlth('48720000'),
    toWlth('53940000'),
    toWlth('59160000'),
    toWlth('64380000'),
    toWlth('69600000')
  ]; // example: marketing token allocation

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'wlth', value: wlth },
    { name: 'communityFund', value: deploymentCofing.communityFundWallet },
    { name: 'duration', value: deploymentCofing.nftVestingDuration },
    { name: 'cadence', value: deploymentCofing.nftVestingCadence },
    { name: 'allocation', value: deploymentCofing.genesisNftVestingAllocation },
    { name: 'leftoversUnlockDelay', value: deploymentCofing.leftoversUnlockDelay },
    { name: 'vestingStartTimestamp', value: deploymentCofing.genesisNftVestingAllocation },
    { name: 'tokenReleaseDistribution', value: tokenReleaseDistribution }
  ];

  await deploy(hre, 'GenesisNFTVesting', parameters);
};

export default deployGenesisNFTVesting;
deployGenesisNFTVesting.tags = ['tge', 'genesisNFTVesting', 'all'];
