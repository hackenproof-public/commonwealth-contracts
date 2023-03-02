import { ethers } from 'hardhat';
import { toUsdc } from '../test/utils';
import { InvestmentFund } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const usdcAddress = '0x7b34B0D50249142aa3d6F9978790E8c28F52403E';
  const investmentNftAddress = '0xD95545CAb7fA827b0008D5738b55908087FddDa0';
  const treasuryWallet = '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63';
  const managementFee = 1000;
  const cap = toUsdc('1000000');

  const [deployer] = await ethers.getSigners();

  console.log('Deploying Investment Fund contract...');
  const investmentFund: InvestmentFund = await deploy('InvestmentFund', deployer, [
    'Investment Fund',
    usdcAddress,
    investmentNftAddress,
    treasuryWallet,
    managementFee,
    cap
  ]);

  console.log(`Investment Fund deployed to ${investmentFund.address}`);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    await verifyContract(investmentFund.address, [
      'Investment Fund',
      usdcAddress,
      investmentNftAddress,
      treasuryWallet,
      managementFee,
      cap
    ]);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
