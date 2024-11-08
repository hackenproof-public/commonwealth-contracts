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

const strategicPartnersRound1Setup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
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
    allocation: 69600050,
    duration: ONE_MONTH * 18,
    cadence: ONE_MONTH,
    vestingStartTimestamp: 0 //Math.floor(Date.now() / 1000) + ONE_MONTH // TODO
  };

  const parameters = [
    { name: '_gamification', value: vestingParameters.gamification },
    { name: '_owner', value: deploymentCofing.ownerAccount },
    { name: '_wlth', value: wlth },
    { name: '_secondarySalesWallet', value: deploymentCofing.secondarySalesWallet },
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

export default strategicPartnersRound1Setup;
strategicPartnersRound1Setup.tags = ['tge', 'spround1Setup', 'all'];

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

  await vestingContract.connect(ownerWallet).whitelistedWalletSetup(walletAddress, tokenDistribution(allocation));

  console.log(`Successfully setted up wallet ${walletAddress}`);
}

function tokenDistribution(allocation: number) {
  // 6 month cliff, 10% unlock, 12 month linear vest
  return [
    toWlth('0'), //vesting start timestamp
    toWlth('0'), //end of cadence1
    toWlth('0'), //end of cadence2
    toWlth('0'), //end of cadence3
    toWlth('0'), //end of cadence4
    toWlth('0'), //end of cadence5
    toWlth((allocation / 10).toString()), //end of cadence6
    toWlth((allocation / 10 + (allocation * 9) / 120).toString()), //end of cadence7
    toWlth((allocation / 10 + (allocation * 18) / 120).toString()), //end of cadence8
    toWlth((allocation / 10 + (allocation * 27) / 120).toString()), //end of cadence9
    toWlth((allocation / 10 + (allocation * 36) / 120).toString()), //end of cadence10
    toWlth((allocation / 10 + (allocation * 45) / 120).toString()), //end of cadence11
    toWlth((allocation / 10 + (allocation * 54) / 120).toString()), //end of cadence12
    toWlth((allocation / 10 + (allocation * 63) / 120).toString()), //end of cadence13
    toWlth((allocation / 10 + (allocation * 72) / 120).toString()), //end of cadence14
    toWlth((allocation / 10 + (allocation * 81) / 120).toString()), //end of cadence15
    toWlth((allocation / 10 + (allocation * 90) / 120).toString()), //end of cadence16
    toWlth((allocation / 10 + (allocation * 99) / 120).toString()), //end of cadence17
    toWlth(allocation.toString()) //end of cadence18
  ]; // Strategic Partners Round 1 token allocation distribution
}

// last wallet allocation table:
// 0x0a664b77340e7F07dB49f9deA59E8d118fB114c2
// [0,0,0,0,0,0,2199100000000000000000,3848425000000000000000,5497750000000000000000,7147075000000001000000,8796400000000000000000,10445725000000000000000,12095049999999890000000,13744375000000000000000,15393700000000000000000,17043024999999998000000,18692350000000000000000,20341675000000000000000,21991000000000000000000]
