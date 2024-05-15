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

const marketingSetup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
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
    allocation: 92500000,
    duration: ONE_MONTH * 30,
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

  const vesting = await deploy(hre, 'WhitelistedVesting', parameters);
  vestingAddress = vesting?.address!;

  const csvFilePath = __dirname + '/../data/Marketing.csv';
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

export default marketingSetup;
marketingSetup.tags = ['tge', 'marketingSetup', 'all'];

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
  // 1 month cliff, 30% unlock, 5 month cliff, 24 month linear vest
  return [
    toWlth('0'), //vesting start timestamp
    toWlth(((allocation * 3) / 10).toString()), //end of cadence1
    toWlth(((allocation * 3) / 10).toString()), //end of cadence2
    toWlth(((allocation * 3) / 10).toString()), //end of cadence3
    toWlth(((allocation * 3) / 10).toString()), //end of cadence4
    toWlth(((allocation * 3) / 10).toString()), //end of cadence5
    toWlth(((allocation * 3) / 10).toString()), //end of cadence6
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 1) / 240).toString()), //end of cadence7
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 2) / 240).toString()), //end of cadence8
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 3) / 240).toString()), //end of cadence9
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 4) / 240).toString()), //end of cadence10
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 5) / 240).toString()), //end of cadence11
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 6) / 240).toString()), //end of cadence12
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 7) / 240).toString()), //end of cadence13
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 8) / 240).toString()), //end of cadence14
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 9) / 240).toString()), //end of cadence15
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 10) / 240).toString()), //end of cadence16
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 11) / 240).toString()), //end of cadence17
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 12) / 240).toString()), //end of cadence18
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 13) / 240).toString()), //end of cadence19
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 14) / 240).toString()), //end of cadence20
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 15) / 240).toString()), //end of cadence21
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 16) / 240).toString()), //end of cadence22
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 17) / 240).toString()), //end of cadence23
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 18) / 240).toString()), //end of cadence24
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 19) / 240).toString()), //end of cadence25
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 20) / 240).toString()), //end of cadence26
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 21) / 240).toString()), //end of cadence27
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 22) / 240).toString()), //end of cadence28
    toWlth(((allocation * 3) / 10 + (allocation * 7 * 23) / 240).toString()), //end of cadence29
    toWlth(allocation.toString()) //end of cadence30
  ]; // Marketing token allocation distribution
}
