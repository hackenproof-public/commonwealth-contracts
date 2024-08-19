import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFT, InvestmentNFT } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { confirmYesOrNo, upgrade } from '../utils/deployment';

const royaltyChange: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const genesisNFT1Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1');
  const genesisNFT2Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV2');
  const alphaFundNFTAddress = undefined;
  const pricelessFundNFTAddress = undefined;
  const secondarySalesWallet = await getContractAddress(hre.network.config.chainId!, 'communityFundWallet');
  const deploymentConfig = getDeploymentConfig();
  const royalty = deploymentConfig.nftRoyalty;

  console.log('genesisNFT1Address: ', genesisNFT1Address);
  console.log('genesisNFT2Address: ', genesisNFT2Address);
  console.log('alphaFundNFTAddress: ', alphaFundNFTAddress);
  console.log('pricelessFundNFTAddress: ', pricelessFundNFTAddress);
  console.log('secondarySalesWallet: ', secondarySalesWallet);
  console.log('royalty: ', royalty);

  if (
    alphaFundNFTAddress === undefined ||
    pricelessFundNFTAddress === undefined ||
    (await confirmYesOrNo('Do you want to proceed? [y/N] '))
  )
    throw Error('Script aborted or contract address not provided');

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const genesisNFT1 = (await ethers.getContractAt('GenesisNFT', genesisNFT1Address, wallet)) as GenesisNFT;

  const genesisNFT2 = (await ethers.getContractAt('GenesisNFT', genesisNFT2Address, wallet)) as GenesisNFT;

  const alphaFundNFT = (await ethers.getContractAt('GenesisNFT', alphaFundNFTAddress, wallet)) as InvestmentNFT;

  const pricelessFundNFT = (await ethers.getContractAt('GenesisNFT', pricelessFundNFTAddress, wallet)) as InvestmentNFT;

  console.log('Upgraging GenesisNFT series1 contract');
  await upgrade(hre, 'GenesisNFT', genesisNFT1Address);
  console.log('Setting royalty for GenesisNFT series 1 contract');
  const s1tx = await genesisNFT1.setRoyalty(secondarySalesWallet, royalty);
  await s1tx.wait();
  console.log('Setting royalty for GenesisNFT series 1 contract done. tx hash: ', s1tx.hash);

  console.log('Upgraging GenesisNFT series2 contract');
  await upgrade(hre, 'GenesisNFT', genesisNFT2Address);
  console.log('Setting royalty for GenesisNFT series 2 contract');
  const s2tx = await genesisNFT2.setRoyalty(secondarySalesWallet, royalty);
  await s2tx.wait();
  console.log('Setting royalty for GenesisNFT series 2 contract done. tx hash: ', s2tx.hash);

  console.log('Upgraging AlphaFundNFT contract');
  await upgrade(hre, 'InvestmentNFT', alphaFundNFTAddress);
  console.log('Setting royalty for AlphaFundNFT contract');
  const alphatx = await alphaFundNFT.setRoyalty(secondarySalesWallet, royalty);
  await alphatx.wait();
  console.log('Setting royalty for AlphaFundNFT contract done. tx hash: ', alphatx.hash);

  console.log('Upgrading PricelessFundNFT contract');
  await upgrade(hre, 'InvestmentNFT', pricelessFundNFTAddress);
  console.log('Setting royalty for PricelessFundNFT contract');
  const pricelesstx = await pricelessFundNFT.setRoyalty(secondarySalesWallet, royalty);
  await pricelesstx.wait();
  console.log('Setting royalty for PricelessFundNFT contract done. tx hash: ', pricelesstx.hash);

  console.log('Done');
};

export default royaltyChange;
royaltyChange.tags = ['royaltyChange'];
