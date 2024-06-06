import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { WlthBonusStaking } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const setBonusStakingSchedule: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const startTimestamp = undefined;
  const duration = undefined;

  if (!startTimestamp || !duration) {
    throw new Error('Please define vesting start timestamp and duration');
  }

  const stakingAddress = await getContractAddress(hre.network.config.chainId!, 'WlthBonusStaking');

  const staking = (await ethers.getContractAt('WlthBonusStaking', stakingAddress, wallet)) as WlthBonusStaking;

  console.log('Setting up staking schedule');

  const tx = await staking.setStakingSchedule(startTimestamp, duration);
  await tx.wait();

  console.log('Done');
};

export default setBonusStakingSchedule;
setBonusStakingSchedule.tags = ['setBonusStakingSchedule'];
