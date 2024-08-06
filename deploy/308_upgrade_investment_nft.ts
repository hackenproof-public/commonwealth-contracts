import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { upgrade } from '../utils/deployment';

const upgradeInvestmentNFT: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const nftaddress = undefined;

  if (nftaddress === undefined) {
    throw Error('Please configure nft address in the upgrade script.');
  }

  await upgrade(hre, 'InvestmentNFT', nftaddress);
};

export default upgradeInvestmentNFT;
upgradeInvestmentNFT.tags = ['upgrade', 'upgradeInvestmentNFT'];
