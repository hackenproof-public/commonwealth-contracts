import { NonceManager } from '@ethersproject/experimental';
import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { StakingGenesisNFTVesting } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { parseEther } from 'ethers/lib/utils';

type Reward = {
  account: string;
  series1Rewards: string;
  series2Rewards: string;
};

const setupRewards: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = __dirname + '/../data/stakingRewards.csv';
  const delimiter = ',';
  const vestingAddress = await getContractAddress(hre.network.config.chainId!, 'StakingGenesisNFTVesting');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

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

      if (series1Rewards > 0 || series2Rewards > 0) {
        rewards.push({
          account: address,
          series1Rewards: parseEther(series1Rewards).toString(),
          series2Rewards: parseEther(series2Rewards).toString()
        });
      }
    });
   
  for await (const chunk of readStream) {
  }
  const out = async () => {
    console.log('Setting up rewards');
    let setupFinished = false;
    let startIndex = 0;
    let endIndex = 300;

    do {
      const partialRewards = rewards.slice(startIndex, endIndex);

      console.log(
        `Setting up rewards from address ${rewards[startIndex].account} to address ${rewards[endIndex - 1].account}`
      );
      const tx = await stakingGenesisNFTVesting.setRewards(partialRewards);
      await tx.wait();

      startIndex = endIndex;
      setupFinished = endIndex === rewards.length;
      endIndex = endIndex + 300 < rewards.length ? (endIndex += 300) : rewards.length;
    } while (!setupFinished);
  };

  await out();

  console.log('Done');
};

export default setupRewards;
setupRewards.tags = ['setupStakingNFTRewards'];
