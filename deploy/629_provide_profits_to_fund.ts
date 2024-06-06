import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { InvestmentFund, USDC } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const provideProfitsToFund: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );
  const walletAddress = await wallet.getAddress();
  const usdcAddress = await getContractAddress(hre.network.config.chainId!, 'USDC');
  const investmentFundAddress = undefined; //'';

  const profitsAmount = undefined; //toUsdc();

  if (!investmentFundAddress || !profitsAmount) {
    throw new Error('Please provide investment fund address and profits amount');
  }

  const investmentFund = (await ethers.getContractAt(
    'InvestmentFund',
    investmentFundAddress,
    wallet
  )) as InvestmentFund;

  const usdc = (await ethers.getContractAt('USDC', usdcAddress, wallet)) as USDC;

  const registeredProjects = await investmentFund.listProjects();
  const walletRegistered = registeredProjects.includes(walletAddress);

  console.log('Upgrade rules...');
  const allowFunctionTx = await investmentFund.allowFunctionsInStates();
  await allowFunctionTx.wait();
  console.log('Upgraded rules.', allowFunctionTx.hash);

  if (!walletRegistered) {
    console.log('Registering wallet as project...');

    const addProjectTx = await investmentFund.addProject(walletAddress);
    await addProjectTx.wait();

    console.log('Wallet registered as project.', addProjectTx.hash);
  }

  console.log('Approving usdc to fund...');
  const transferTx = await usdc.approve(investmentFund.address, profitsAmount);
  await transferTx.wait();
  console.log('Approved usdc to fund.', transferTx.hash);

  console.log('Providing profit to fund...');
  const provideProfitTx = await investmentFund.provideProfit(profitsAmount);
  await provideProfitTx.wait();
  console.log('Provided profit to fund.', provideProfitTx.hash);

  const payouts = await investmentFund.getPayoutsCount();

  console.log('Unlocking payouts...');
  const unlockTx = await investmentFund.unlockPayoutsTo(payouts.sub(1));
  await unlockTx.wait();
  console.log('Unlocked payouts.', unlockTx.hash);

  console.log('Done');
};

export default provideProfitsToFund;
provideProfitsToFund.tags = ['provideProfitsToFund'];
