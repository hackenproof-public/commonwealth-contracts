import { constants } from 'ethers';
import hre from 'hardhat';
import { env } from 'process';
import { deployProxyAndVerify, getEnvByNetwork } from './utils';

async function main() {
  const parameters = [
    { name: 'owner', value: env.OWNER_ACCOUNT },
    { name: 'finalTimestamp_', value: constants.MaxUint256 },
    { name: 'smallNft_', value: constants.AddressZero },
    { name: 'largeNft_', value: getEnvByNetwork('GENESIS_NFT_CONTRACT', hre.network.name) },
    { name: 'rewardPeriod_', value: 86_400 }
  ];

  await deployProxyAndVerify('StakingGenesisNFT', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
