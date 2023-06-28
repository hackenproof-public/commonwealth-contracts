import { network } from 'hardhat';
import { env } from 'process';
import { deployProxyAndVerify, getEnvByNetwork } from './utils';

async function main() {
  const SECONDS_IN_YEAR = 31536000;
  const ONE_YEAR = 1 * SECONDS_IN_YEAR;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const THREE_YEARS = 3 * SECONDS_IN_YEAR;
  const FOUR_YEARS = 4 * SECONDS_IN_YEAR;
  const parameters = [
    { name: 'owner', value: env.OWNER_ACCOUNT },
    { name: 'token', value: getEnvByNetwork('WLTH_CONTRACT', network.name) },
    { name: 'usdc', value: getEnvByNetwork('USDC_CONTRACT', network.name) },
    { name: 'dexQuoter', value: getEnvByNetwork('QUOTER_CONTRACT', network.name) },
    { name: 'fee', value: env.STAKING_TRANSACTION_FEE },
    { name: 'treasuryWallet', value: env.STAKING_TREASURY_WALLET },
    { name: 'maxDiscount', value: env.STAKING_MAX_DISCOUNT },
    { name: 'periods', value: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS] },
    { name: 'coefficients', value: [5000, 3750, 3125, 2500] }
  ];

  await deployProxyAndVerify('StakingWlth', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
