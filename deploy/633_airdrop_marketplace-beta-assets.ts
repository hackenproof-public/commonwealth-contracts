import { NonceManager } from '@ethersproject/experimental';
import parse from 'csv-parser';
import { parseEther } from 'ethers/lib/utils';
import fs from 'fs';
import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { toUsdc, toWlth } from '../test/utils';
import { GenesisNFT, InvestmentNFT, USDC, Wlth } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const airdropGenesisNftLegacy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = __dirname + '/../data/marketplaceBetaUsers.csv';
  const delimiter = ',';
  const wlthAddress = await getContractAddress(network.config.chainId!, 'Wlth');
  const usdcAddress = await getContractAddress(network.config.chainId!, 'USDC');
  const genesisNFTV1Address = await getContractAddress(network.config.chainId!, 'GenesisNFTV1');
  const genesisNFTV2Address = await getContractAddress(network.config.chainId!, 'GenesisNFTV2');
  const freeFundNftAddress = '0xfDB234F03921cABA05f849aB063ac59B984490c3';
  const alphaFundNftAddress = '0x4566FBe3c7e745fCF58d9F186E04881B101D61b5';

  const wlthAmount = toWlth('200000');
  const usdcAmount = toUsdc('10000');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const wlth: Wlth = (await ethers.getContractAt('Wlth', wlthAddress, wallet)) as Wlth;
  const usdc: USDC = (await ethers.getContractAt('USDC', usdcAddress, wallet)) as USDC;
  const genesisNFT1: GenesisNFT = (await ethers.getContractAt('GenesisNFT', genesisNFTV1Address, wallet)) as GenesisNFT;
  const genesisNFT2: GenesisNFT = (await ethers.getContractAt('GenesisNFT', genesisNFTV2Address, wallet)) as GenesisNFT;
  const freeFundNft: InvestmentNFT = (await ethers.getContractAt(
    'InvestmentNFT',
    freeFundNftAddress,
    wallet
  )) as InvestmentNFT;
  const alphaFundNft: InvestmentNFT = (await ethers.getContractAt(
    'InvestmentNFT',
    alphaFundNftAddress,
    wallet
  )) as InvestmentNFT;

  const wallets: string[] = [];
  let freeFundNftStartIndex = 270; //max 362
  let alphaFundNftStartIndexFirst = 314; //max 364
  let alphaFundNftStartIndexSecond = 516; //max 566

  const readStream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['Address'];
      wallets.push(address);
    });

  for await (const chunk of readStream) {
  }

  const out = async () => {
    console.log('Airdrop started');
    for (let i = 0; i < wallets.length; i++) {
      console.log('Airdropping to ', wallets[i]);

      console.log('ETH airdrop');
      const tx = await wallet.sendTransaction({
        to: wallets[i],
        value: parseEther('0.1')
      });
      await tx.wait();

      console.log('Wlth airdrop');
      const wlthTx = await wlth.transfer(wallets[i], wlthAmount);
      await wlthTx.wait();

      console.log('Usdc airdrop');
      const usdcTx = await usdc.mint(wallets[i], usdcAmount);
      await usdcTx.wait();

      console.log('Gen1 airdrop');
      const gen1Tx = await genesisNFT1.mint(wallets[i], 2);
      await gen1Tx.wait();

      console.log('Gen2 airdrop');
      const gen2Tx = await genesisNFT2.mint(wallets[i], 2);
      await gen2Tx.wait();

      console.log('FreeFundNft airdrop');
      const freeFundNftTx = await freeFundNft.transferFrom(
        await wallet.getAddress(),
        wallets[i],
        freeFundNftStartIndex
      );
      await freeFundNftTx.wait();

      console.log('AlphaFund airdrop first');
      const alphaFundTxFirst = await alphaFundNft.transferFrom(
        await wallet.getAddress(),
        wallets[i],
        alphaFundNftStartIndexFirst
      );
      await alphaFundTxFirst.wait();

      console.log('AlphaFund airdrop second');
      const alphaFundTxSecond = await alphaFundNft.transferFrom(
        await wallet.getAddress(),
        wallets[i],
        alphaFundNftStartIndexSecond
      );
      await alphaFundTxSecond.wait();

      freeFundNftStartIndex++;
      alphaFundNftStartIndexFirst++;
      alphaFundNftStartIndexSecond++;
    }
  };

  await out();
  console.log('Done');
};

export default airdropGenesisNftLegacy;
airdropGenesisNftLegacy.tags = ['marketplaceBetaAirdrop'];
