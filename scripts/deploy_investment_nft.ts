import { env } from 'process';
import { deployProxyAndVerify } from './utils';

async function main() {
  const parameters = [
    { name: 'name', value: env.GENESIS_NFT_NAME },
    { name: 'symbol', value: env.GENESIS_NFT_SYMBOL },
    { name: 'owner', value: env.OWNER_ACCOUNT }
  ];

  await deployProxyAndVerify('InvestmentNFT', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
