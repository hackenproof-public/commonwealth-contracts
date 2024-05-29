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

const teamSetup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();
  const ONE_MONTH = 2592000;
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const ownerWallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );
  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');

  const vestingParameters = {
    gamification: false,
    allocation: 140000000,
    duration: ONE_MONTH * 33,
    cadence: ONE_MONTH,
    vestingStartTimestamp: 0
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

  const csvFilePath = __dirname + '/../data/Team.csv';
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

export default teamSetup;
teamSetup.tags = ['tge', 'teamSetup', 'all'];

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
    .whitelistedWalletSetup(walletAddress, tokenDistribution(allocation));

  console.log(`Successfully setted up wallet ${walletAddress}`);
}

function tokenDistribution(allocation: number) {
  // 9 month cliff, 10% unlock, 24 month linear vest
  return [
    toWlth('0'), //vesting start timestamp
    toWlth('0'), //end of cadence1
    toWlth('0'), //end of cadence2
    toWlth('0'), //end of cadence3
    toWlth('0'), //end of cadence4
    toWlth('0'), //end of cadence5
    toWlth('0'), //end of cadence6
    toWlth('0'), //end of cadence7
    toWlth('0'), //end of cadence8
    toWlth((allocation / 10).toString()), //end of cadence9
    toWlth((allocation / 10 + (allocation * 9 * 1) / 240).toString()), //end of cadence10
    toWlth((allocation / 10 + (allocation * 9 * 2) / 240).toString()), //end of cadence11
    toWlth((allocation / 10 + (allocation * 9 * 3) / 240).toString()), //end of cadence12
    toWlth((allocation / 10 + (allocation * 9 * 4) / 240).toString()), //end of cadence13
    toWlth((allocation / 10 + (allocation * 9 * 5) / 240).toString()), //end of cadence14
    toWlth((allocation / 10 + (allocation * 9 * 6) / 240).toString()), //end of cadence15
    toWlth((allocation / 10 + (allocation * 9 * 7) / 240).toString()), //end of cadence16
    toWlth((allocation / 10 + (allocation * 9 * 8) / 240).toString()), //end of cadence17
    toWlth((allocation / 10 + (allocation * 9 * 9) / 240).toString()), //end of cadence18
    toWlth((allocation / 10 + (allocation * 9 * 10) / 240).toString()), //end of cadence19
    toWlth((allocation / 10 + (allocation * 9 * 11) / 240).toString()), //end of cadence20
    toWlth((allocation / 10 + (allocation * 9 * 12) / 240).toString()), //end of cadence21
    toWlth((allocation / 10 + (allocation * 9 * 13) / 240).toString()), //end of cadence22
    toWlth((allocation / 10 + (allocation * 9 * 14) / 240).toString()), //end of cadence23
    toWlth((allocation / 10 + (allocation * 9 * 15) / 240).toString()), //end of cadence24
    toWlth((allocation / 10 + (allocation * 9 * 16) / 240).toString()), //end of cadence25
    toWlth((allocation / 10 + (allocation * 9 * 17) / 240).toString()), //end of cadence26
    toWlth((allocation / 10 + (allocation * 9 * 18) / 240).toString()), //end of cadence27
    toWlth((allocation / 10 + (allocation * 9 * 19) / 240).toString()), //end of cadence28
    toWlth((allocation / 10 + (allocation * 9 * 20) / 240).toString()), //end of cadence29
    toWlth((allocation / 10 + (allocation * 9 * 21) / 240).toString()), //end of cadence30
    toWlth((allocation / 10 + (allocation * 9 * 22) / 240).toString()), //end of cadence31
    toWlth((allocation / 10 + (allocation * 9 * 23) / 240).toString()), //end of cadence32
    toWlth(allocation.toString()) //end of cadence33
  ]; // Team token allocation distribution
}
