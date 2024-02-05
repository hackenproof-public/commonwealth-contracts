import parse from 'csv-parser';
import { parseEther } from 'ethers/lib/utils';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { StakingGenesisNFTVesting } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getZkSyncSingerWallet } from '../utils/zkSyncWallet';

type Reward = {
  account: string;
  series1Rewards: string;
  series2Rewards: string;
};

const setupRewards: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const chainId = hre.network.config.chainId!;
  const csvFilePath = __dirname + '/../data/stakingRewards.csv';
  const delimiter = ',';
  const vestingAddress = await getContractAddress(hre.network.config.chainId!, 'StakingGenesisNFTVesting');
  const wallet = getZkSyncSingerWallet();

  const stakingGenesisNFTVesting = (await ethers.getContractAt(
    'StakingGenesisNFTVesting',
    vestingAddress,
    wallet
  )) as StakingGenesisNFTVesting;
  const rewards: Reward[] = [];

  const readStream = await fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['Address'];
      const series1Rewards = row['Series1 Rewards'];
      const series2Rewards = row['Series2 Rewards'];

      rewards.push({
        account: address,
        series1Rewards: parseEther(series1Rewards).toString(),
        series2Rewards: parseEther(series2Rewards).toString()
      });
      console.log(rewards[0]);
    });

  for await (const chunk of readStream) {
  }
  const out = async () => {
    console.log('Setting up rewards');

    const tx = await stakingGenesisNFTVesting.setRewards(rewards);
    console.log('Transaction hash:', tx.hash);
    await tx.wait();
  };

  await out();

  console.log('Done');
};

export default setupRewards;
setupRewards.tags = ['setupStakingNFTRewards'];
