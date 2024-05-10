import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { toUsdc } from '../test/utils';
import { InvestmentFund, InvestmentNFT } from '../typechain-types';

const setupInvestmentFundMetadata: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const pricelessNftAddress = undefined;

  const alphaNftAddress = undefined;
  const alphaFundAddress = undefined;

  // Priceless Fund 'Slice'
  const pricelessMetadata = {
    name: "Priceless Fund 'Slice'",
    description:
      "This NFT represents your Slice of the Priceless Fund, the world's first free ('earn-to-own') venture capital fund brought to you by Common Wealth. The fund comprises 15 promising startups in Web3. View the latest value and deep dive at the URL provided.",
    image: 'ipfs://QmXauExHkHrdiEwV7q5uYAg6x6VmQXCL885UoQwnvLypqx',
    externalUrl: 'https://app.joincommonwealth.xyz/funds/priceless-fund'
  };

  // Alpha Fund 'Slice'
  const alphaMetadata = {
    name: "Alpha Fund 'Slice'",
    description:
      'The Alpha Fund from Common Wealth targets a diversified portfolio of highly anticipated early-stage Web3 projects with a special interest in BRC20 tokens, Real World Assets (RWAs) on-chain, Decentralised Physical Infrastructure Networks (DePIN), and Web3 Gaming. This NFT represents your ownership Slice of the Alpha Fund.',
    image: 'ipfs://QmRTj4qwzq9Fzwszm1v3oSuXpWDpn7UQ2fadbz3MpTBv8W',
    externalUrl: 'https://app.joincommonwealth.xyz/funds/alpha-fund'
  };

  if (
    !pricelessMetadata ||
    !pricelessMetadata.name ||
    !pricelessMetadata.description ||
    !pricelessMetadata.image ||
    !pricelessMetadata.externalUrl
  ) {
    throw Error('Please configure priceless metadata in the upgrade script.');
  }

  if (
    !alphaMetadata ||
    !alphaMetadata.name ||
    !alphaMetadata.description ||
    !alphaMetadata.image ||
    !alphaMetadata.externalUrl
  ) {
    throw Error('Please configure alpha metadata in the upgrade script.');
  }

  if (pricelessNftAddress === undefined || alphaFundAddress === undefined || alphaNftAddress === undefined) {
    throw Error('Please configure addresses in the upgrade script.');
  }

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const pricelessInvestmentNft = (await ethers.getContractAt(
    'InvestmentNFT',
    pricelessNftAddress,
    wallet
  )) as InvestmentNFT;

  const alphaInvestmentNft = (await ethers.getContractAt('InvestmentNFT', alphaNftAddress, wallet)) as InvestmentNFT;
  const alphaInvestmentFund = (await ethers.getContractAt(
    'InvestmentFund',
    alphaFundAddress,
    wallet
  )) as InvestmentFund;

  console.log('Setting up contract');

  console.log('Setting up Priceless Fund Metadata');
  const pricelessMetadataTx = await pricelessInvestmentNft.setAllMetadata(pricelessMetadata);
  await pricelessMetadataTx.wait();

  console.log('Setting up Minimum Value');
  const minimumValueTx = await alphaInvestmentNft.setMinimumValue(toUsdc('50'));
  await minimumValueTx.wait();

  console.log('Setting up Alpha Fund Metadata');
  const alphaMetadataTx = await alphaInvestmentNft.setAllMetadata(alphaMetadata);
  await alphaMetadataTx.wait();

  console.log('Allowing functions in states');
  const allowFunctionTx = await alphaInvestmentFund.allowFunctionInStates();
  await allowFunctionTx.wait();

  console.log('Done');
};

export default setupInvestmentFundMetadata;
setupInvestmentFundMetadata.tags = ['setupInvestmentFundMetadata'];
