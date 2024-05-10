import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { upgrade } from '../utils/deployment';

const upgradeInvestmentFund: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const nftaddress = undefined;
  const investmentFundAddress = undefined;

  if (investmentFundAddress === undefined || nftaddress === undefined) {
    throw Error('Please configure addresses in the upgrade script.');
  }

  console.log('Upgrading InvestmentFund with NFT');
  await upgrade(hre, 'InvestmentNFT', nftaddress);

  console.log('Upgrading InvestmentFund');
  await upgrade(hre, 'InvestmentFund', investmentFundAddress);
};

export default upgradeInvestmentFund;
upgradeInvestmentFund.tags = ['upgrade', 'upgradeInvestmentFund'];
