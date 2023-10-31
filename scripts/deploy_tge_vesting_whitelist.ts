import { ethers } from 'hardhat';
import { WhitelistedVesting } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const TWENTY_FOUR_BILIONS = 24000000;
  const HALF_HOUR = 1800;
  const TWELVE_HOURS = 43200;
  const vestingStartTimestamp = Math.floor(Date.now() / 1000);
  const allocation = TWENTY_FOUR_BILIONS;
  const cadence = HALF_HOUR;
  const duration = TWELVE_HOURS;

  const [deployer] = await ethers.getSigners();
  const owner = '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63';
  const wlth = '0x34ac60166247079687a2D69A526768438F3e66cC';
  const whitelist = ['0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63', '0xE1F9877005c68f4D5118461B313180Cc544B1aCF'];

  console.log('Vesting Start Timestamp: ' + vestingStartTimestamp);
  console.log('Deploying GenesisNFTVesting contract...');
  const whitelistedVesting: WhitelistedVesting = await deploy(
    'WhitelistedVesting',
    [owner, wlth, 0, allocation, duration, cadence, vestingStartTimestamp, whitelist],
    deployer
  );

  console.log(`StakingGenNFTVesting deployed to ${whitelistedVesting.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(whitelistedVesting.address, [
      owner,
      wlth,
      0,
      allocation,
      duration,
      cadence,
      vestingStartTimestamp,
      whitelist
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});