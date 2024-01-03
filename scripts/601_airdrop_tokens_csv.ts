import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { Contract, Provider, utils, Wallet } from 'zksync-web3';
import { toUsdc, toWlth } from '../test/utils';
import { getEnvByNetwork } from './utils';

import MIRROR_ABI from '../artifacts/contracts/GenesisNFTmirror.sol/GenesisNFTmirror.json';
import NFT_ABI from '../artifacts/contracts/GenesisNFTV1.sol/GenesisNFTV1.json';

export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function main() {
  const csvFilePath = __dirname + '/data.csv';
  const delimiter = ';';

  // stage
  // const usdcAddress = '0xd5dEe34F2611A75b31d2339a1F6Cc8B92E7d9d36';
  // const wlthAddress = '0x0BF95BDF972C268ca86a4a6C4b3c29a4181D698D';
  // const s1Address = '0xe80C0EbE2EF00c5399368AC44F5D8f9407E51206';
  // const s2Address = '0x586D8dD6C382424D9eA849B49d4269201FA6d89E';

  // dev
  const usdcAddress = '0x6A6cA681690dB8B75e899db8c64171969f037108';
  const wlthAddress = '0x527Cb7bb76eCEE076384CFd9FC82061b515cc2B8';
  // const s1Address = '0x946D4a6fC82adfD4f13e72198210fC859ACF21b0';
  // const s2Address = '0x86576D86135473f0CC50dE152508605CBC01AFA8'; 

  const GEN1NFT_ADDRESS = '0x946D4a6fC82adfD4f13e72198210fC859ACF21b0'; // s1 goerli
  const S1_MIRROR_ADDRESS = '0xeB8b1Ec414059e0d29108A2b2851EeAAF5Ec9c1c';

  const GEN2NFT_ADDRESS = '0x86576D86135473f0CC50dE152508605CBC01AFA8'; // s2 goerli
  const S2_MIRROR_ADDRESS = '0xD061CdA871C0691734478F95f563407c8EEB6A25';
  const l1Provider = new ethers.providers.JsonRpcProvider(
    'https://eth-goerli.g.alchemy.com/v2/HlxwpAK0C-3s3rLFa8Y8y0aSo1bqUxK9'
  );

  const goerliWallet = new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', 'goerli')!, l1Provider);

  // Set a constant that accesses the Layer 1 contract.
  const nftV1 = new Contract(GEN1NFT_ADDRESS, NFT_ABI.abi, goerliWallet);
  const nftV2 = new Contract(GEN2NFT_ADDRESS, NFT_ABI.abi, goerliWallet);

  const l2Provider = new Provider('https://testnet.era.zksync.dev');
  // Get the current address of the zkSync L1 bridge.
  const zkSyncAddress = await l2Provider.getMainContractAddress();
  // Get the `Contract` object of the zkSync bridge.
  const zkSyncContract = new Contract(zkSyncAddress, utils.ZKSYNC_MAIN_ABI, goerliWallet);
  const mirrorInterface = new ethers.utils.Interface(MIRROR_ABI.abi);

  const wallet = getSingerWallet();
  // const s1 = await ethers.getContractAt('GenesisNFTV1', s1Address, wallet);
  // const s2 = await ethers.getContractAt('GenesisNFTV2', s2Address, wallet);
  const usdc = await ethers.getContractAt('USDC', usdcAddress, wallet);
  const wlth = await ethers.getContractAt('Wlth', wlthAddress, wallet);

  // console.log(`Parsing and processing CSV file: ${csvFilePath}`);
  const transactions: {
    to: string;
    ethAmount: number;
    wlthAmount: number;
    usdcAmount: number;
    s1Amount: number;
    s2Amount: number;
  }[] = [];

  const readStream = await fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const toAddress = row['Address'];
      const ethAmount = row['ETH'];
      const wlthAmount = row['WLTH'];
      const usdcAmount = row['USDC'];
      const s1Amount = row['GenesisNFTSeries1'];
      const s2Amount = row['GenesisNFTSeries2'];

      const transaction = {
        to: toAddress,
        ethAmount: ethAmount,
        wlthAmount: wlthAmount,
        usdcAmount: usdcAmount,
        s1Amount: s1Amount,
        s2Amount: s2Amount
      };

      transactions.push(transaction);
    });

  for await (const chunk of readStream) {
  }

  const out = async () => {
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      console.log(
        `Minting and transferring tokens to ${transaction.to}`,
        `ETH amount: ${transaction.ethAmount}`,
        `WLTH amount: ${transaction.wlthAmount}`,
        `USDC amount: ${transaction.usdcAmount}`,
        `GenesisNFTSeries1 amount: ${transaction.s1Amount}`,
        `GenesisNFTSeries2 amount: ${transaction.s2Amount}`
      );

      if (transaction.s1Amount > 0) {
        const data = mirrorInterface.encodeFunctionData('moveToken', [transaction.s1Amount, transaction.to]);
        const gasPrice = await l1Provider.getGasPrice();

        // Define a constant for gas limit which estimates the limit for the L1 to L2 transaction.
        const gasLimit = await l2Provider.estimateL1ToL2Execute({
          contractAddress: S1_MIRROR_ADDRESS,
          calldata: data,
          caller: utils.applyL1ToL2Alias(GEN1NFT_ADDRESS)
        });

        const baseCost = await zkSyncContract.l2TransactionBaseCost(
          gasPrice,
          gasLimit.mul(transaction.s1Amount),
          utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
        );

        const tx = await nftV1.mintNotify(transaction.to, transaction.s1Amount, gasLimit.mul(transaction.s1Amount), {
          // Pass the necessary ETH `value` to cover the fee for the operation
          value: baseCost.mul(transaction.s1Amount),
          gasPrice: 1000000000
        });
        // await tx.wait();
        await delay(500);
        console.log(`transferred ${transaction.s1Amount} GenesisNFTSeries1 to ${transaction.to}`);
      }

      if (transaction.s2Amount > 0) {
        // const s2Tx = await s2.connect(wallet).mint(transaction.to, transaction.s2Amount);
        // s2Tx.waitFinalize();
        const data = mirrorInterface.encodeFunctionData('moveToken', [transaction.s2Amount, transaction.to]);
        const gasPrice = await l1Provider.getGasPrice();

        // Define a constant for gas limit which estimates the limit for the L1 to L2 transaction.
        const gasLimit = await l2Provider.estimateL1ToL2Execute({
          contractAddress: S2_MIRROR_ADDRESS,
          calldata: data,
          caller: utils.applyL1ToL2Alias(GEN2NFT_ADDRESS)
        });

        const baseCost = await zkSyncContract.l2TransactionBaseCost(
          gasPrice,
          gasLimit.mul(transaction.s2Amount),
          utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
        );

        const tx = await nftV2.mintNotify(transaction.to, transaction.s2Amount, gasLimit.mul(transaction.s2Amount), {
          // Pass the necessary ETH `value` to cover the fee for the operation
          value: baseCost.mul(transaction.s2Amount),
          gasPrice: 1000000000
        });
        await delay(500);
        // await tx.wait();
        console.log(`transferred ${transaction.s2Amount} GenesisNFTSeries2 to ${transaction.to}`);
      }

      if (transaction.wlthAmount > 0) {
        const wlthTx = await wlth.connect(wallet).transfer(transaction.to, toWlth(transaction.wlthAmount.toString()));
        await delay(500);
        // await wlthTx.waitFinalize();
        console.log(`transferred ${transaction.wlthAmount} WLTH to ${transaction.to}`);
      }
      if (transaction.usdcAmount > 0) {
        const usdcTx = await usdc.connect(wallet).transfer(transaction.to, toUsdc(transaction.usdcAmount.toString()));
        await delay(500);
        // await usdcTx.waitFinalize();
        console.log(`transferred ${transaction.usdcAmount} USDC to ${transaction.to}`);
      }

      if (transaction.ethAmount > 0) {
        const ethTx = await wallet.sendTransaction({
          to: transaction.to,
          value: ethers.utils.parseEther(transaction.ethAmount.toString())
        });

        // await ethTx.waitFinalize();
        await delay(500);
        console.log(`transferred ${transaction.ethAmount} ETH to ${transaction.to}`);
      }
    }
  };

  // console.log(transactions);

  await out();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function getSingerWallet() {
  const deployerPrivateKey = getEnvByNetwork('WALLET_PRIVATE_KEY', 'zkTestnet')!;

  const zkSyncProvider = new Provider('https://testnet.era.zksync.dev/'); // need to be changed to mainnet when mainnet lunch

  return new Wallet(deployerPrivateKey, zkSyncProvider);
}