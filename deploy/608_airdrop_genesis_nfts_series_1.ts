import { NonceManager } from '@ethersproject/experimental';
import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFT } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

type GenesisSeries1Data = {
  account: string;
  ids: number[];
};

const airdropGenesisNftSeries1: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = __dirname + '/../data/stakingRewards.csv';
  const delimiter = ',';
  const genesisNftSeries1Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const genesisNftSeries1 = (await ethers.getContractAt('GenesisNFT', genesisNftSeries1Address, wallet)) as GenesisNFT;

  const genesisSeries1Data: GenesisSeries1Data[] = [];

  const readStream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['Address'];
      const ids = row['Gen1Total'] as string;

      if (ids.length > 2) {
        const values = ids
          .slice(1, ids.length - 1)
          .split(',')
          .map((id) => parseInt(id));
        genesisSeries1Data.push({
          account: address,
          ids: values
        });
      }
    });

  for await (const chunk of readStream) {
  }

  const out = async () => {
    console.log('Minting Genesis NFT Series 1');

    for (let i = 0; i < genesisSeries1Data.length; i++) {
      const { account, ids } = genesisSeries1Data[i];
      console.log('Minting for ', account, ids);
      await genesisNftSeries1.mintWithIds(account, ids);
    }
  };

  await out();
  console.log('Done');
};

export default airdropGenesisNftSeries1;
airdropGenesisNftSeries1.tags = ['airdropGenesisNftSeries1'];
