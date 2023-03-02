import { ethers } from 'hardhat';
import { toUsdc } from '../test/utils';
import { PeriodicVesting } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const vestedTokenAddress = '0x7b34B0D50249142aa3d6F9978790E8c28F52403E'; // USDC
  const startBlock = await ethers.provider.getBlockNumber();
  const tokenAllocation = toUsdc('9000');
  const durationInSeconds = 7776000; // 90 days
  const blockTimeInSeconds = 12;
  const durationInBlocks = Math.floor(durationInSeconds / blockTimeInSeconds);
  const cadence = 1;
  const cliff = 0;

  const [deployer] = await ethers.getSigners();

  const config = [
    vestedTokenAddress,
    deployer.address,
    startBlock,
    [tokenAllocation, durationInBlocks, cadence, cliff]
  ];

  console.log('Deploying Periodic Vesting contract...');
  const vesting: PeriodicVesting = await deploy('PeriodicVesting', deployer, config);

  console.log(`Periodic Vesting deployed to ${vesting.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(vesting.address, config);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
