import { NonceManager } from '@ethersproject/experimental';
import { parseEther } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
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

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;
  const provider = new ethers.providers.JsonRpcProvider(rpc);

  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const wlth: Wlth = (await ethers.getContractAt('Wlth', wlthAddress, wallet)) as Wlth;
  const usdc: USDC = (await ethers.getContractAt('USDC', usdcAddress, wallet)) as USDC;
  const genesisNFT1: GenesisNFT = (await ethers.getContractAt('GenesisNFT', genesisNFTV1Address, wallet)) as GenesisNFT;
  const genesisNFT2: GenesisNFT = (await ethers.getContractAt('GenesisNFT', genesisNFTV2Address, wallet)) as GenesisNFT;

  console.log(wallet);
  console.log(await provider.getBalance(await wallet.getAddress()));

  const wlthAmount = parseEther('10000000');
  const usdcAmount = toUsdc('2000000');
  const receivers = [
    '0xE1F9877005c68f4D5118461B313180Cc544B1aCF',
    '0xf57A3Ee6b7F9E39192A242cAED11277701d43837',
    '0xA0EdAc16CDA5adE83eF88BAc53BB551729e2a182',
    '0x2348af96882D273506b16De0C40ab3d60b0c042d',
    '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63'
  ];
  const gen1Amount = 5;
  const gen2Amount = 3;

  for (const receiver of receivers) {
    // console.log('ETH airdrop');
    // const tx = await wallet.sendTransaction({
    //   to: receiver,
    //   value: parseEther('1')
    // });

    // await tx.wait();

    console.log('Wlth airdrop');
    const wlthTx = await wlth.transfer(receiver, wlthAmount);
    await wlthTx.wait();

    console.log('Usdc airdrop');
    const usdcTx = await usdc.mint(receiver, usdcAmount);
    await usdcTx.wait();

    console.log(receiver);
    console.log('Gen1 airdrop');
    const gen1Tx = await genesisNFT1.mint(receiver, gen1Amount);
    await gen1Tx.wait();

    console.log('Gen2 airdrop');
    const gen2Tx = await genesisNFT2.mint(receiver, gen2Amount);
    await gen2Tx.wait();
  }
};

export default deployStakingGenNFTVesting;
deployStakingGenNFTVesting.tags = ['tge', 'airdropTestFunds', 'all'];
