import hre from 'hardhat';
import { env } from 'process';
import { deployProxyAndVerify, getEnvByNetwork } from './utils';

async function main() {
  const parameters = [
    { name: 'owner', value: env.OWNER_ACCOUNT },
    { name: 'swapRouter', value: getEnvByNetwork('SWAP_ROUTER_ADDRESS', hre.network.name) },
    { name: 'feeTier', value: env.ZERO_POINT_THREE_FEE_TIER }
  ];

  await deployProxyAndVerify('UniswapSwapper', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
