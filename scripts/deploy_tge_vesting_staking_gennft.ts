import { ethers } from 'hardhat';
import { StakingGenNFTVesting } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const TWENTY_FOUR_BILIONS = 24000000;
  const SECONDS_IN_YEAR = 31536000;
  const ONE_MONTH = SECONDS_IN_YEAR / 12;
  const vestingStartTimestamp = Math.floor(Date.now() / 1000);
  const allocation = TWENTY_FOUR_BILIONS;

  const [deployer] = await ethers.getSigners();
  const owner = '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63';
  const wlth = '0x34ac60166247079687a2D69A526768438F3e66cC';
  const stakingGenNFT = '0x6f633eD4d3fb3D433BD14Fb776D2c4Ba23308A13';

  console.log('Vesting Start Timestamp: ' + vestingStartTimestamp);
  console.log('Deploying StakingGenNFTVesting contract...');
  const StakingGenNFTVesting: StakingGenNFTVesting = await deploy(
    'StakingGenNFTVesting',
    [owner, wlth, allocation, vestingStartTimestamp, stakingGenNFT],
    deployer
  );

  console.log(`StakingGenNFTVesting deployed to ${StakingGenNFTVesting.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(StakingGenNFTVesting.address, [owner, wlth, allocation, vestingStartTimestamp, stakingGenNFT]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
