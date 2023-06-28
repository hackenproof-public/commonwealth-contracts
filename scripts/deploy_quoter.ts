import { network } from 'hardhat';
import { env } from 'process';
import { deployProxyAndVerify, getEnvByNetwork } from './utils';

async function main() {
  const parameters = [
    { name: 'quoter', value: getEnvByNetwork('UNISWAP_QUOTER_V2_ADDRESS', network.name) },
    { name: 'feeTier', value: env.ZERO_POINT_THREE_FEE_TIER }
  ];

  await deployProxyAndVerify('UniswapQuoter', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
