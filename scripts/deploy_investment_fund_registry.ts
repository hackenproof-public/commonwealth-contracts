import { env } from 'process';
import { deployProxyAndVerify } from './utils';

async function main() {
  const parameters = [{ name: 'owner', value: env.OWNER_ACCOUNT }];

  await deployProxyAndVerify('InvestmentFundRegistry', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
