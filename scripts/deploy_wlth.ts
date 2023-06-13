import { env } from 'process';
import { deployProxyAndVerify } from './utils';

async function main() {
  const parameters = [
    { name: 'name', value: env.WLTH_NAME },
    { name: 'symbol', value: env.WLTH_SYMBOL }
  ];

  await deployProxyAndVerify('Wlth', parameters);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
