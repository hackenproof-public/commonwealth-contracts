import { env } from 'process';
import { deployProxyAndVerify } from './utils';

async function main() {
  const parameters = [
    { name: 'owner', value: env.OWNER_ACCOUNT },
    { name: 'wallet', value: env.CROWDSALE_WALLET },
    { name: 'currency', value: env.USDC_CONTRACT },
    { name: 'token', value: env.GENESIS_NFT_CONTRACT },
    { name: 'initialSupply', value: env.CROWDSALE_TOKEN_SUPPLY },
    { name: 'price', value: env.CROWDSALE_TOKEN_PRICE }
  ];

  await deployProxyAndVerify('Crowdsale', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
