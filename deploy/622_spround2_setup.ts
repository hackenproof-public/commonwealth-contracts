import { NonceManager } from '@ethersproject/experimental';
import parse from 'csv-parser';
import { constants } from 'ethers';
import fs from 'fs';
import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { toWlth } from '../test/utils';
import { WhitelistedVesting } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

type WalletsAlllocationData = {
  wallet: string;
  allocation: number;
};

let vestingAddress = constants.AddressZero!;

const strategicPartnersRound2Setup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();
  const ONE_MONTH = 2592000;
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const ownerWallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );
  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');

  const vestingParameters = {
    gamification: true,
    allocation: 10400000,
    duration: ONE_MONTH * 18,
    cadence: ONE_MONTH,
    vestingStartTimestamp: Math.floor(Date.now() / 1000) + ONE_MONTH // TODO
  };

  const parameters = [
    { name: '_gamification', value: vestingParameters.gamification },
    { name: '_owner', value: deploymentCofing.ownerAccount },
    { name: '_wlth', value: wlth },
    { name: '_communityFund', value: deploymentCofing.communityFundWallet },
    { name: '_allocation', value: toWlth(vestingParameters.allocation.toString()) },
    { name: '_duration', value: vestingParameters.duration },
    { name: '_cadence', value: vestingParameters.cadence },
    { name: '_leftoversUnlockDelay', value: deploymentCofing.genesisNftVestingLeftoversUnlockDelay },
    { name: '_vestingStartTimestamp', value: vestingParameters.vestingStartTimestamp },
    { name: '_tokenReleaseDistribution', value: tokenDistribution(vestingParameters.allocation) }
  ];

  const vesting = await deploy(hre, 'WhitelistedVesting', parameters, true, false);
  vestingAddress = vesting?.address!;

  const csvFilePath = __dirname + '/../data/SPRound1.csv';
  const delimiter = ',';
  const walletsAlllocationData: WalletsAlllocationData[] = [];

  const readStream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['Address'];
      const legacyAmount = parseInt(row['Allocation']);

      if (legacyAmount > 0) {
        walletsAlllocationData.push({
          wallet: address,
          allocation: legacyAmount
        });
      }
    });

  for await (const chunk of readStream) {
  }

  const out = async () => {
    for (let i = 0; i < walletsAlllocationData.length; i++) {
      const { wallet, allocation } = walletsAlllocationData[i];
      await whitelistedWalletSetup(vestingAddress, wallet, allocation, ownerWallet);
    }
  };

  await out();
  console.log('Done');
};

export default strategicPartnersRound2Setup;
strategicPartnersRound2Setup.tags = ['tge', 'spround2Setup', 'all'];

async function whitelistedWalletSetup(
  vestingAddress: string,
  walletAddress: string,
  allocation: number,
  ownerWallet: NonceManager
) {
  console.log(`Setting up wallet ${walletAddress} with total allocation of ${allocation} WLTH`);

  const vestingContract: WhitelistedVesting = (await ethers.getContractAt(
    'WhitelistedVesting',
    vestingAddress
  )) as WhitelistedVesting;

  await vestingContract
    .connect(ownerWallet)
    .whitelistedWalletSetup(walletAddress, toWlth(allocation.toString()), await tokenDistribution(allocation));

  console.log(`Successfully setted up wallet ${walletAddress}`);
}

function tokenDistribution(allocation: number) {
  // 5% unlock, 18 month linear vest
  return [
    toWlth(((allocation * 5) / 100).toString()), //vesting start timestamp
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 1) / 1800).toString()), //end of cadence1
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 2) / 1800).toString()), //end of cadence2
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 3) / 1800).toString()), //end of cadence3
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 4) / 1800).toString()), //end of cadence4
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 5) / 1800).toString()), //end of cadence5
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 6) / 1800).toString()), //end of cadence6
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 7) / 1800).toString()), //end of cadence7
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 8) / 1800).toString()), //end of cadence8
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 9) / 1800).toString()), //end of cadence9
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 10) / 1800).toString()), //end of cadence10
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 11) / 1800).toString()), //end of cadence11
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 12) / 1800).toString()), //end of cadence12
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 13) / 1800).toString()), //end of cadence13
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 14) / 1800).toString()), //end of cadence14
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 15) / 1800).toString()), //end of cadence15
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 16) / 1800).toString()), //end of cadence16
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 17) / 1800).toString()), //end of cadence17
    toWlth(allocation.toString()) //end of cadence18
  ]; // Strategic Partners Round 2 token allocation distribution
}
