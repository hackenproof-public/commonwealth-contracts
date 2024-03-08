import pinataSDK from '@pinata/sdk';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { toUsdc } from '../test/utils';
import { InvestmentNFT } from '../typechain-types';
import { getZkSyncSingerWallet } from '../utils/zkSyncWallet';

//This scrip needs to be run separetly for every tier
const airdropFreeFundNfts: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Airdrop started');

  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
  const investmentNFTAddress = '0xaDb3b8DD907d3f0780FD8f20253e0311e83c8A2e'; // undefined;
  const amount = toUsdc('10000'); //undefined;

  if (!investmentNFTAddress || !pinataApiKey || !pinataSecretApiKey || !amount) {
    throw Error(
      'Please configure investmentNFTAddress, pinataApiKey, pinataSecretApiKey and amount in the airdrop script.'
    );
  }

  const pinata = new pinataSDK(pinataApiKey, pinataSecretApiKey);
  const wallet = getZkSyncSingerWallet();

  const nft = (await ethers.getContractAt('InvestmentNFT', investmentNFTAddress, wallet)) as InvestmentNFT;

  const jsonFilePath = __dirname + '/../data/freeFundAirdrop.json';
  const jsonData = fs.readFileSync(jsonFilePath);
  const users = JSON.parse(jsonData.toString()) as any[];
  const metadata = createMetadata(amount.toString());

  if (metadata.image === '') {
    throw Error('Please define image for NFT');
  }
  const { IpfsHash } = await pinata.pinJSONToIPFS(metadata, {
    pinataMetadata: {
      name: 'Investment NFT'
    },
    pinataOptions: {
      cidVersion: 0
    }
  });
  const tokenUri = 'ipfs://' + IpfsHash;
  for (let i = 0; i < users.length; i++) {
    try {
      console.log(`Minting NFT of for user: ${users[i].name}, id: ${users[i].user_uuid}`);

      const tx = await nft.mint(users[i].wallet, amount, tokenUri);
      await tx.wait(1);

      console.log(
        `NFT minted for user: ${users[i].address} with amount: ${amount.toString()} and tokenUri: ${tokenUri}`
      );
    } catch (error) {
      console.log('Something went wrong', error);
      process.exit(1);
    }
  }

  console.log('Airdrop completed');
};

export default airdropFreeFundNfts;
airdropFreeFundNfts.tags = ['airdropFreeFundNfts'];

const createMetadata = (amount: string): any => ({
  name: 'Investment NFT',
  description: 'This NFT confirms your share in investment fund',
  image: '', //'ipfs://QmUJjy9amGiMTZcphKcLtmSfCXWVSf5s9b26JsbAL7PgJk',
  attributes: [
    {
      traitType: 'Investment Fund',
      value: 'Free Fund'
    },
    {
      traitType: 'Investment Value',
      value: amount
    },
    {
      traitType: 'Investment date',
      value: Date.now(),
      displayType: 'date'
    }
  ]
});
