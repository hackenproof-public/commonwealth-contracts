import { env } from 'process';
import { deployProxyAndVerify } from './utils';

async function main() {
  const parameters = [
    { name: 'owner_', value: env.OWNER_ACCOUNT },
    { name: 'wallet_', value: env.CROWDSALE_WALLET },
    { name: 'currency_', value: env.USDC_CONTRACT },
    { name: 'token_', value: env.GENESIS_NFT_CONTRACT },
    { name: 'start_', value: -1 },
    { name: 'tranchesCount_', value: 9 },
    { name: 'whitelistPhaseDuration_', value: 300 }, // 1 hour in blocks
    { name: 'publicPhaseDuration_', value: 300 * 9 }, // 9 hours in blocks
    { name: 'durationBetweenTranches_', value: 300 * 24 } // 24 hours in blocks
  ];

  await deployProxyAndVerify('Crowdsale', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
