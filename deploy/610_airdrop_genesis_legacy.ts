import { NonceManager } from '@ethersproject/experimental';
import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFT } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

type GenesisLegacyData = {
  account: string;
  amount: number;
};

const airdropGenesisNftLegacy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = __dirname + '/../data/stakingRewards.csv';
  const delimiter = ',';
  const genesisNftSeries1Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const genesisNftSeries1 = (await ethers.getContractAt('GenesisNFT', genesisNftSeries1Address, wallet)) as GenesisNFT;

  const genesisLegacyData: GenesisLegacyData[] = [];

  const readStream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['Address'];
      const legacyAmount = parseInt(row['GenLegacy']);

      if (legacyAmount > 0) {
        genesisLegacyData.push({
          account: address,
          amount: legacyAmount
        });
      }
    });

  for await (const chunk of readStream) {
  }

  const out = async () => {
    console.log('Minting Genesis NFT Legacy');
    for (let i = 0; i < genesisLegacyData.length; i++) {
      const { account, amount } = genesisLegacyData[i];
      console.log('Minting for ', account, amount);
      await genesisNftSeries1.mint(account, amount);
    }
  };

  await out();
  console.log('Done');
};

export default airdropGenesisNftLegacy;
airdropGenesisNftLegacy.tags = ['airdropGenesisNftLegacy'];
