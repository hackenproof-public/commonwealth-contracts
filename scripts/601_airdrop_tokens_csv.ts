import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { Provider, Wallet } from 'zksync-web3';
import { toUsdc, toWlth } from '../test/utils';
import { getEnvByNetwork } from './utils';
async function main() {
  const csvFilePath = __dirname + '/data.csv';
  const delimiter = ';';

  const usdcAddress = '0xd5dEe34F2611A75b31d2339a1F6Cc8B92E7d9d36';
  const wlthAddress = '0x0BF95BDF972C268ca86a4a6C4b3c29a4181D698D';
  const s1Address = '0xe80C0EbE2EF00c5399368AC44F5D8f9407E51206';
  const s2Address = '0x586D8dD6C382424D9eA849B49d4269201FA6d89E';

  const wallet = getSingerWallet();
  const s1 = await ethers.getContractAt('GenesisNFTV1', s1Address, wallet);
  const s2 = await ethers.getContractAt('GenesisNFTV2', s2Address, wallet);
  const usdc = await ethers.getContractAt('USDC', usdcAddress, wallet);
  const wlth = await ethers.getContractAt('Wlth', wlthAddress, wallet);

  console.log(`Parsing and processing CSV file: ${csvFilePath}`);
  const transactions: {
    to: string;
    ethAmount: number;
    wlthAmount: number;
    usdcAmount: number;
    s1Amount: number;
    s2Amount: number;
  }[] = [];

  //  const data = fs.readFileSync(csvFilePath);

  //   .pipe(parse({ separator: delimiter }))
  //   .on('data', (row) => {
  //   const toAddress = row['Address'];
  //   const wlthAmount = row['WLTH'];
  //   const usdcAmount = row['USDC'];
  //   const s1Amount = row['GenesisNFTSeries1'];
  //   const s2Amount = row['GenesisNFTSeries2'];

  //   const transaction = {
  //     to: toAddress,
  //     wlthAmount: wlthAmount,
  //     usdcAmount: usdcAmount,
  //     s1Amount: s1Amount,
  //     s2Amount: s2Amount
  //   };

  //   transactions.push(transaction);
  //   })
  //   .on('end', async () => {
  //     console.log(transactions.length)
  // for (let i=0; i<transactions.length;i++) {
  //   const transaction = transactions[i];
  //   console.log(
  //     `Minting and transferring tokens to ${transaction.to}`,
  //     `WLTH amount: ${transaction.wlthAmount}`,
  //     `USDC amount: ${transaction.usdcAmount}`,
  //     `GenesisNFTSeries1 amount: ${transaction.s1Amount}`,
  //     `GenesisNFTSeries2 amount: ${transaction.s2Amount}`
  //   );

  //   if(transaction.wlthAmount>0) {
  //     const tx = await wallet.transfer({to: transaction.to, amount: toWlth(transaction.wlthAmount.toString()), token: wlthAddress});
  //     tx.waitFinalize();
  //     console.log(tx);
  //   };
  //   if(transaction.usdcAmount>0) {await wallet.transfer({to: transaction.to, amount: toUsdc(transaction.usdcAmount.toString()), token: usdcAddress})};
  //   if(transaction.s1Amount>0) {await s1.connect(wallet).mint(transaction.to, transaction.s1Amount)};
  //   if(transaction.s2Amount>0) {await s2.connect(wallet).mint(transaction.to, transaction.s2Amount)};
  // }
  // });

  // for await (const chunk of readStream) {
  // }

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

      if (transaction.wlthAmount > 0) {
        const wlthTx = await wlth.connect(wallet).transfer(transaction.to, toWlth(transaction.wlthAmount.toString()));
        wlthTx.waitFinalize();
      }
      if (transaction.usdcAmount > 0) {
        const usdcTx = await usdc.connect(wallet).transfer(transaction.to, toUsdc(transaction.usdcAmount.toString()));
        usdcTx.waitFinalize();
      }
      if (transaction.s1Amount > 0) {
        const s1Tx = await s1.connect(wallet).mint(transaction.to, transaction.s1Amount);
        s1Tx.waitFinalize();
      }
      if (transaction.s2Amount > 0) {
        const s2Tx = await s2.connect(wallet).mint(transaction.to, transaction.s2Amount);
        s2Tx.waitFinalize();
      }

      if (transaction.ethAmount > 0) {
        const ethTx = await wallet.sendTransaction({
          to: transaction.to,
          value: ethers.utils.parseEther(transaction.ethAmount.toString())
        });
        ethTx.waitFinalize();
      }
    }
  };

  console.log(transactions);

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
