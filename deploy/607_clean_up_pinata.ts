import pinataSDK from '@pinata/sdk';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const airdropFreeFundNfts: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Cleanup started');

  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
  const pinata = new pinataSDK(pinataApiKey, pinataSecretApiKey);

  const response = await pinata.pinList({
    pageLimit: 1000,
    status: 'pinned',
    pinStart: '2023-06-04T00:00:00.000Z',
    pinEnd: '2024-02-22T00:00:00.000Z'
  });
  // const response =  pinata.getFilesByCount({ status: 'pinned' }, 2);

  //   for await (const item of pinata.getFilesByCount({ status: 'pinned', pinStart: '2023-01-04T00:00:00.000Z', pinEnd: '2023-12-22T00:00:00.000Z' })) {
  //     console.log((item as any).ipfs_pin_hash);
  //   }
  //   response.next().then((result) => {}
  console.log(response.rows.length);
  let i = 0;
  for (const row of response.rows) {
    // console.log(row.ipfs_pin_hash);
    try {
      console.log('Removing pin: ' + row.ipfs_pin_hash);
      console.log(++i);
      await pinata.unpin(row.ipfs_pin_hash);
    } catch (e) {
      console.log(e);
    }
  }

  console.log('Cleanup completed');
};

export default airdropFreeFundNfts;
airdropFreeFundNfts.tags = ['cleanupPinata'];
