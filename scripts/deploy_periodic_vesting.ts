import hre, { ethers } from 'hardhat';
import { toUsdc } from '../test/utils';
import { deployProxyAndVerify, getEnvByNetwork } from './utils';

async function main() {
  const [deployer] = await ethers.getSigners();
  const tokenAllocation = toUsdc('9000');
  const durationInSeconds = 7776000; // 90 days
  const blockTimeInSeconds = 12;
  const durationInBlocks = Math.floor(durationInSeconds / blockTimeInSeconds);
  const cadence = 1;
  const cliff = 0;

  const parameters = [
    { name: 'token', value: getEnvByNetwork('USDC_CONTRACT', hre.network.name) },
    { name: 'beneficiary', value: deployer.address },
    { name: 'startBlock', value: await ethers.provider.getBlockNumber() },
    { name: 'periods', value: [[tokenAllocation, durationInBlocks, cadence, cliff]] }
  ];

  await deployProxyAndVerify('PeriodicVesting', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
