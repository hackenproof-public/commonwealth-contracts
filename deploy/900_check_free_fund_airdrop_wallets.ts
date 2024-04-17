import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';

type Reward = {
  account: string;
  series1Rewards: string;
  series2Rewards: string;
};

const checkFreeFundAirdropWallets: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = __dirname + '/../data/freeFundAirdopAddresses.csv';
  const delimiter = ',';
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;
  const provider = new ethers.providers.JsonRpcProvider(rpc);

  const addresses: string[] = [];

  const data: any = { owners: [] };

  const readStream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['address'];

      if (address !== 'NULL') {
        addresses.push(address);
      }
    });

  let counter = 0;
  for await (const chunk of readStream) {
  }
  const out = async () => {
    console.log(addresses.length);
    for (let i = 0; i < addresses.length; i++) {
      console.log('Checking owner', addresses[i], i);
      const code = await provider.getCode(addresses[i]);
      if (code !== '0x') {
        console.log(`Owner ${addresses[i]} has code`);
        data.owners.push(addresses[i]);
        counter++;
      }
    }

    data.owners.push = addresses;

    if (data.owners.length > 0) {
      fs.writeFileSync('freeFundAirdropWalletsCheck.json', JSON.stringify(data, null, 2), 'utf8');
    }
  };

  await out();

  console.log(counter);

  console.log('Done');
};

export default checkFreeFundAirdropWallets;
checkFreeFundAirdropWallets.tags = ['checkFreeFundAirdropWallets'];
