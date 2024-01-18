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
  const usdcAddress = '0x18921C5bd7137eF0761909ea39FF7B6dC9A89405';
  const wlthAddress = '0x6a6CB56009d83128F2fAa8743f1002BCc449B11d';
  const GEN1NFT_ADDRESS = '0x944a6e65D23D9c17f1c1B715E334cbA0fEf7C52A'; 
  const S1_MIRROR_ADDRESS = '0x6fCCE629848EE01f583BA5ccF5cb901735c1e155';
  const GEN2NFT_ADDRESS = '0x8A7394B21d3bd9174d611E9044Ac9ebD5151C5C3'; 
  const S2_MIRROR_ADDRESS = '0x04BE07A6Fa58BB28f18466d547F0848156de58aE';

  const l1Provider = new ethers.providers.JsonRpcProvider(
    'https://eth-sepolia.g.alchemy.com/v2/kaJnbyOsoAMnNzsiCjwfcZR69GwHiUAZ'
  );

  const sepoliaWallet = new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', 'sepolia')!, l1Provider);

  // Set a constant that accesses the Layer 1 contract.
  const nftV1 = new Contract(GEN1NFT_ADDRESS, NFT_ABI.abi, sepoliaWallet);
  const nftV2 = new Contract(GEN2NFT_ADDRESS, NFT_ABI.abi, sepoliaWallet);

  const l2Provider = new Provider('https://sepolia.era.zksync.dev');
  // Get the current address of the zkSync L1 bridge.
  const zkSyncAddress = await l2Provider.getMainContractAddress();
  // Get the `Contract` object of the zkSync bridge.
  const zkSyncContract = new Contract(zkSyncAddress, utils.ZKSYNC_MAIN_ABI, sepoliaWallet);
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
          gasLimit.mul(transaction.s1Amount).mul(2),
          utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
        );

        const tx = await nftV1.mintNotify(transaction.to, transaction.s1Amount, gasLimit.mul(transaction.s1Amount), {
          // Pass the necessary ETH `value` to cover the fee for the operation
          value: baseCost.mul(transaction.s1Amount),
          gasPrice: gasPrice
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
          gasLimit.mul(transaction.s2Amount).mul(2),
          utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
        );

        const tx = await nftV2.mintNotify(transaction.to, transaction.s2Amount, gasLimit.mul(transaction.s2Amount), {
          // Pass the necessary ETH `value` to cover the fee for the operation
          value: baseCost.mul(transaction.s2Amount),
          gasPrice: gasPrice
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

  console.log("")
  const deployerPrivateKey = getEnvByNetwork('WALLET_PRIVATE_KEY', 'sepoliaZkTestnet')!;

  const zkSyncProvider = new Provider('https://sepolia.era.zksync.dev'); // need to be changed to mainnet when mainnet lunch

  return new Wallet(deployerPrivateKey, zkSyncProvider);
}
