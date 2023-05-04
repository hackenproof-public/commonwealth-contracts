import hre from 'hardhat';
import { env } from 'process';
import { deployProxyAndVerify, getEnvByNetwork } from './utils';

async function main() {
  const parameters = [
    { name: 'owner', value: env.OWNER_ACCOUNT },
    { name: 'sourceNft', value: getEnvByNetwork('GENESIS_NFT_V1_CONTRACT', hre.network.name) },
    { name: 'targetNft', value: getEnvByNetwork('GENESIS_NFT_CONTRACT', hre.network.name) }
  ];

  await deployProxyAndVerify('GenesisNFTUpgrader', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
