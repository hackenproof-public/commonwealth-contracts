import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { upgrade } from '../utils/deployment';

const upgradeInvestmentNFT: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const nftaddress = '0x5964B0a43bFAeC1CF2F2ECFfFc07Bf95CEB1Fca8';

  if (nftaddress === undefined) {
    throw Error('Please configure nft address in the upgrade script.');
  }

  await upgrade(hre, 'InvestmentNFT', nftaddress);
};

export default upgradeInvestmentNFT;
upgradeInvestmentNFT.tags = ['upgrade', 'upgradeInvestmentNFT'];
