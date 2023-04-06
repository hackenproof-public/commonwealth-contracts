import hre, { ethers } from 'hardhat';
import { toUsdc } from '../test/utils';
import { InvestmentFund } from '../typechain-types';
import { confirm, deploy, verifyContract } from './utils';

async function main() {
  const name = 'Brand New Investment Fund';
  const usdcAddress = '0x7b34B0D50249142aa3d6F9978790E8c28F52403E';
  const investmentNftAddress = '0xAB0178B160F2f4b29c1719196Bda153AC71c8404';
  const treasuryWallet = '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63';
  const managementFee = 1000;
  const cap = toUsdc('1000000');

  const [deployer] = await ethers.getSigners();

  console.log(
    `Running Investment Fund deployment script on network ${hre.network.name} (chainId: ${hre.network.config.chainId})`
  );
  console.log('\nParameters');
  console.log(` name: ${name}`);
  console.log(` usdc: ${usdcAddress}`);
  console.log(` investmentNft: ${investmentNftAddress}`);
  console.log(` treasuryWallet: ${treasuryWallet}`);
  console.log(` managementFee: ${managementFee}`);
  console.log(` cap: ${cap}`);

  if (await confirm('\nDo you want to continue? [y/N] ')) {
    console.log('Deploying Investment Fund contract...');

    const investmentFund: InvestmentFund = await deploy('InvestmentFund', deployer, [
      name,
      usdcAddress,
      investmentNftAddress,
      treasuryWallet,
      managementFee,
      cap
    ]);

    console.log(`Investment Fund deployed to ${investmentFund.address}`);

    if (await confirm('\nDo you want to verify contract? [y/N] ')) {
      await verifyContract(investmentFund.address, [
        name,
        usdcAddress,
        investmentNftAddress,
        treasuryWallet,
        managementFee,
        cap
      ]);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
