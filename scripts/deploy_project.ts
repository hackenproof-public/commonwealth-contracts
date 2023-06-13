import hre from 'hardhat';
import { env } from 'process';
import { deployProxyAndVerify, getEnvByNetwork } from './utils';

async function main() {
  const parameters = [
    { name: 'name', value: env.PROJECT_NAME },
    { name: 'owner', value: env.OWNER_ACCOUNT },
    { name: 'swapper', value: getEnvByNetwork('SWAPPER_CONTRACT', hre.network.name) }
  ];

  await deployProxyAndVerify('Project', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
