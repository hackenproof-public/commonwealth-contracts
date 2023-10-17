import { ethers } from 'hardhat';
import { GenesisNFTVesting } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const TWENTY_FOUR_BILIONS = 24000000;
  const SECONDS_IN_YEAR = 31536000;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const ONE_MONTH = SECONDS_IN_YEAR / 12;
  const HALF_HOUR = 1800;
  const TWELVE_HOURS = 43200;
  const ONE_SECOND = 1000;
  const ONE_TOKEN = (1 * 10) ^ 18;
  const vestingStartTimestamp = Math.floor(Date.now() / 1000);
  const allocation = (TWENTY_FOUR_BILIONS * 10) ^ 18;
  const cadence = HALF_HOUR;
  const duration = TWELVE_HOURS;

  const [deployer] = await ethers.getSigners();
  const owner = '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63';
  const wlth = '0x34ac60166247079687a2D69A526768438F3e66cC';
  const stakingGenNFT = '0x5A1B235fBAC03870846D36b9D7E0D18531edEDe3';
  const genNFTseries1 = '0x3A029Bf68636f82b56FBAD2670bC7E70e2E547C4';
  const genNFTseries2 = '0x2D1B22DF4dA028A72009ae4f5d73fe25D1F4F845';

  console.log('Vesting Start Timestamp: ' + vestingStartTimestamp);
  console.log('Deploying GenesisNFTVesting contract...');
  const StakingGenNFTVesting: GenesisNFTVesting = await deploy(
    'GenesisNFTVesting',
    [owner, wlth, duration, cadence, vestingStartTimestamp, genNFTseries1, genNFTseries2, stakingGenNFT],
    deployer
  );

  console.log(`GenesisNFTVesting deployed to ${StakingGenNFTVesting.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(StakingGenNFTVesting.address, [
      owner,
      wlth,
      duration,
      cadence,
      vestingStartTimestamp,
      genNFTseries1,
      genNFTseries2,
      stakingGenNFT
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
