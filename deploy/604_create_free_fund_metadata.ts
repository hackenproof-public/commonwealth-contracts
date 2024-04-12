import pinataSDK from '@pinata/sdk';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const airdropFreeFundNfts: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Metadata creation started');

  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;

  const pinata = new pinataSDK(pinataApiKey, pinataSecretApiKey);

  const metadata = createMetadata();

  if (metadata.image === '') {
    throw Error('Please define image for NFT');
  }
  const { IpfsHash } = await pinata.pinJSONToIPFS(metadata, {
    pinataMetadata: {
      name: 'Free Fund slice NFT metadata'
    },
    pinataOptions: {
      cidVersion: 0
    }
  });

  const tokenUri = 'ipfs://' + IpfsHash;

  console.log('Token URI:', tokenUri);
  console.log('Metadata created completed');
};

export default airdropFreeFundNfts;
airdropFreeFundNfts.tags = ['createFreeFundMetadata'];

const createMetadata = (): any => ({
  name: 'Priceless NFT',
  description: 'This NFT is a slice of Pricess Fund',
  image: 'ipfs://QmXauExHkHrdiEwV7q5uYAg6x6VmQXCL885UoQwnvLypqx',
  external_url: ''
});
