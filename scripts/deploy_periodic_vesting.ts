import hre, { ethers } from 'hardhat';
import { toUsdc } from '../test/utils';
import { deployProxyAndVerify, getEnvByNetwork } from './utils';
import { env } from 'process';

async function main() {
  const beneficiary = env.OWNER_ACCOUNT as string;
  const tokenAllocation = toUsdc('259200');
  const durationInSeconds = 15552000; // 180 days
  const blockTimeInSeconds = 12;
  const durationInBlocks = Math.floor(durationInSeconds / blockTimeInSeconds);
  const cadence = 1;
  const cliff = 0;

  const parameters = [
    { name: 'token', value: getEnvByNetwork('USDC_CONTRACT', hre.network.name) },
    { name: 'beneficiary', value: beneficiary },
    { name: 'startBlock', value: await ethers.provider.getBlockNumber() },
    { name: 'periods', value: [[tokenAllocation, durationInBlocks, cadence, cliff]] }
  ];

  await deployProxyAndVerify('PeriodicVesting', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
