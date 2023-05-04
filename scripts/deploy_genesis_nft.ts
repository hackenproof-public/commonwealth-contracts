import { env } from 'process';
import { deployProxyAndVerify } from './utils';

async function main() {
  const parameters = [
    { name: 'name', value: env.GENESIS_NFT_NAME },
    { name: 'symbol', value: env.GENESIS_NFT_SYMBOL },
    { name: 'factor', value: env.GENESIS_NFT_FACTOR },
    { name: 'owner', value: env.OWNER_ACCOUNT },
    { name: 'royaltyAccount', value: env.GENESIS_NFT_ROYALTY_ACCOUNT },
    { name: 'royaltyValue', value: env.GENESIS_NFT_ROYALTY },
    { name: 'tokenUri', value: env.GENESIS_NFT_TOKEN_URI }
  ];

  await deployProxyAndVerify('GenesisNFT', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
