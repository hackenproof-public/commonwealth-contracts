import { network } from 'hardhat';
import { env } from 'process';
import { deployProxyAndVerify, getEnvByNetwork } from './utils';

async function main() {
  const parameters = [
    { name: 'owner', value: env.OWNER_ACCOUNT },
    { name: 'name', value: env.INVESTMENT_FUND_NAME },
    { name: 'currency', value: getEnvByNetwork('USDC_CONTRACT', network.name) },
    { name: 'investmentNft', value: getEnvByNetwork('INVESTMENT_NFT_CONTRACT', network.name) },
    { name: 'stakingWlth', value: getEnvByNetwork('STAKING_WLTH_CONTRACT', network.name) },
    { name: 'treasuryWallet', value: env.INVESTMENT_FUND_TREASURY_WALLET },
    { name: 'managementFee', value: env.INVESTMENT_FUND_MANAGEMENT_FEE },
    { name: 'cap', value: env.INVESTMENT_FUND_CAP }
  ];

  await deployProxyAndVerify('InvestmentFund', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
