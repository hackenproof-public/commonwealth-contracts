import { parseEther } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { toUsdc } from '../test/utils';
import { GenesisNFT, USDC, Wlth } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';

const deployStakingGenNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const wlthAddress = await getContractAddress(network.config.chainId!, 'Wlth');
  const usdcAddress = await getContractAddress(network.config.chainId!, 'USDC');
  const genesisNFTV1Address = await getContractAddress(network.config.chainId!, 'GenesisNFTV1');
  const genesisNFTV2Address = await getContractAddress(network.config.chainId!, 'GenesisNFTV2');

  const provider = new ethers.providers.JsonRpcProvider('https://sepolia.base.org');
  const wallet = new ethers.Wallet('f1a503f2394a2445abc84a65e6a4e28c4496b65b0c6e28a63ad8b924cb1b7232', provider);

  const wlth: Wlth = (await ethers.getContractAt('Wlth', wlthAddress, wallet)) as Wlth;
  const usdc: USDC = (await ethers.getContractAt('USDC', usdcAddress, wallet)) as USDC;
  const genesisNFT1: GenesisNFT = (await ethers.getContractAt(
    'GenesisNFTV1',
    genesisNFTV1Address,
    wallet
  )) as GenesisNFT;
  const genesisNFT2: GenesisNFT = (await ethers.getContractAt(
    'GenesisNFTV2',
    genesisNFTV2Address,
    wallet
  )) as GenesisNFT;

  console.log(wallet.address);
  console.log(await provider.getBalance(wallet.address));

  const wlthAmount = parseEther('10000000');
  const usdcAmount = toUsdc('2000000');
  const receiver = '0x2348af96882D273506b16De0C40ab3d60b0c042d';
  const gen1Amount = 5;
  const gen2Amount = 3;

  console.log('ETH airdrop');
  const tx = await wallet.sendTransaction({
    to: receiver,
    value: parseEther('1')
  });

  await tx.wait();

  console.log('Wlth airdrop');
  const wlthTx = await wlth.transfer(receiver, wlthAmount);
  await wlthTx.wait();

  console.log('Usdc airdrop');
  const usdcTx = await usdc.mint(receiver, usdcAmount);
  await usdcTx.wait();

  console.log('Gen1 airdrop');
  const gen1Tx = await genesisNFT1.mint(receiver, gen1Amount);
  await gen1Tx.wait();

  console.log('Gen2 airdrop');
  const gen2Tx = await genesisNFT2.mint(receiver, gen2Amount);
  await gen2Tx.wait();
};

export default deployStakingGenNFTVesting;
deployStakingGenNFTVesting.tags = ['tge', 'airdropTestFunds', 'all'];
