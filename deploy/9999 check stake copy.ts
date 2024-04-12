import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { StakingGenesisNFT } from '../typechain-types';

type Reward = {
  account: string;
  series1Rewards: string;
  series2Rewards: string;
};

const setupRewards: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = __dirname + '/../data/stakingRewards.csv';
  const delimiter = ',';
  // const provider = ethers.getDefaultProvider();
  const provider = new ethers.providers.JsonRpcProvider(
    'https://eth-mainnet.g.alchemy.com/v2/STmaoEYiJ6TPXyYJgVaWAxumyRWxv2xm'
  );

  const stakingGenesisNFTVesting = (await ethers.getContractAt(
    'StakingGenesisNFT',
    '0xAB14624691d0D1b62F9797368104Ef1F8C20dF83'
  )) as StakingGenesisNFT;
  const addresses: string[] = [];

  const data: any = { owners: [] };

  const readStream = await fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['Address'];
      const legacy = row['legacySeries1Balance'];
      // const gen2Staked = row['series2Staked'];

      if (legacy > 0) {
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
      fs.writeFileSync('staked.json', JSON.stringify(data, null, 2), 'utf8');
    }
  };

  await out();

  console.log(counter);

  console.log('Done');
};

export default setupRewards;
setupRewards.tags = ['checkStake'];
