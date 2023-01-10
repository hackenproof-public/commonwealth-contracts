import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { InvestmentFund } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const usdcAddress: string = '0x7b34B0D50249142aa3d6F9978790E8c28F52403E';
  const investmentNftAddress: string = '0x67a46E219230752561758f29501Afd638D6E6bd3';
  const treasuryWallet: string = '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63';
  const managementFee: number = 200;
  const cap: BigNumber = BigNumber.from(1000000 * 10 ** 6);

  const [deployer]: SignerWithAddress[] = await ethers.getSigners();

  console.log(`Deploying Investment Fund contract...`);
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
