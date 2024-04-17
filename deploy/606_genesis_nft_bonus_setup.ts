import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { confirmYesOrNo } from '../scripts/utils';
import { getZkSyncSingerWallet } from '../utils/zkSyncWallet';

//TODO take data from excel file
const genesisNftBonusSetup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Setup started');

  const genesisNftVestingAddress = '0x'; // needs to be redeployed
  const bonusSetupArray: number[] = []; // [1,2,3,6,87] as hex values: [0x1,0x2,0x3,0x6,0x57]

  if (!genesisNftVestingAddress) {
    throw Error('Please configure genesisNftVestingAddress');
  }

  const wallet = getZkSyncSingerWallet();

  const vesting = await ethers.getContractAt('GenesisNFTVesting', genesisNftVestingAddress, wallet);

  console.log('loaded bonus setup array: ' + bonusSetupArray);

  if (await confirmYesOrNo('Do you want to deploy contract? [y/N] ')) {
    console.log(`Setting bonuses... `);
    const tx = await vesting.connect(wallet).setupBonus(bonusSetupArray);
    await tx.wait(1);
  }
};

export default genesisNftBonusSetup;
genesisNftBonusSetup.tags = ['genesisNftBonusSetup'];
