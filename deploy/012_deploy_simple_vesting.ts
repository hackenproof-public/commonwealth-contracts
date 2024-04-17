// import { network } from 'hardhat';
// import { DeployFunction } from 'hardhat-deploy/dist/types';
// import { HardhatRuntimeEnvironment } from 'hardhat/types';
// import { getContractAddress } from '../utils/addresses';
// import { getDeploymentConfig } from '../utils/config';
// import { deploy } from '../utils/deployment';

// const deployGenesisNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
//   const deploymentCofing = getDeploymentConfig();

//   const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
//   const beneficiary = '0x01C16932E9bA3bBdE28FD3Bd007E6c9B9Bbe2b56'; // some given/hardcoded address

//   const parameters = [
//     { name: 'owner', value: deploymentCofing.ownerAccount },
//     { name: 'wlth', value: wlth },
//     { name: 'beneficiary', value: beneficiary },
//     { name: 'duration', value: deploymentCofing.nftVestingDuration },
//     { name: 'cadence', value: deploymentCofing.nftVestingCadence },
//     { name: 'allocation', value: deploymentCofing.genesisNftVestingAllocation },
//     { name: 'leftoversUnlockDelay', value: deploymentCofing.leftoversUnlockDelay },
//     { name: 'vestingStartTimestamp', value: deploymentCofing.genesisNftVestingAllocation }
//   ];

//   await deploy(hre, 'GenesisNFTVesting', parameters);
// };

// export default deployGenesisNFTVesting;
// deployGenesisNFTVesting.tags = ['tge', 'genesisNFTVesting', 'all'];
