import { Contract, Provider } from 'zksync-web3';

const GENESISNFT_MIRROR_ADDRESS = '0xb54FD0C533138B44Dc56Fd1f1923a751e2782b78';
const ABI = require('./mirror.json');

async function main() {
  // Initialize the provider
  const l2Provider = new Provider('https://testnet.era.zksync.dev');

  const counterContract = new Contract(GENESISNFT_MIRROR_ADDRESS, ABI, l2Provider);

  const address = '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63';
  const value = (await counterContract.balanceOf(address)).toString();

  const tokenId = 5;
  const owner = (await counterContract.ownerOf(tokenId)).toString();

  console.log(`The balance of ${address} is ${value}`);
  console.log(`The owner of token ${tokenId} is ${owner}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
