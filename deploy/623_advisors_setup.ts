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

const advisorsSetup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
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
    allocation: 50325000,
    duration: ONE_MONTH * 27,
    cadence: ONE_MONTH,
    vestingStartTimestamp: 0
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

  const csvFilePath = __dirname + '/../data/Advisors.csv';
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

  // const out = async () => {
  //   //for (let i = 0; i < walletsAlllocationData.length; i++) {
  //    // const { wallet, allocation } = walletsAlllocationData[i];
  //     await whitelistedWalletSetup('0xC3E633D490E58E632cF5780F7Cf02fB6148e6460', '0xb6A46ef97A2082E002087Cb1282c94C12b9B3D93', 25000, ownerWallet);
  //   //}
  // };

  await out();
  console.log('Done');
};

export default advisorsSetup;
advisorsSetup.tags = ['tge', 'advisorsSetup', 'all'];

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

  // const tab = [];
  // for (let i = 0; i<33; i++) {
  //   tab.push(await vestingContract
  //   .connect(ownerWallet)
  //   .totalWalletAllocationInCadence(i));
  // }

  // const contractTab = tokenDistribution(50325000);

  // for (let i = 0; i<tab.length ; i++) {
  //   console.log(contractTab[i].sub(tab[i]).toString());
  // }

  console.log(`Successfully setted up wallet ${walletAddress}`); // failuer: 0xb6A46ef97A2082E002087Cb1282c94C12b9B3D93
  // console.log("wallet allocation: "+tokenDistribution(25000))
}

function tokenDistribution(allocation: number) {
  // 3 month cliff, 24 month linear vest
  return [
    toWlth('0'), //vesting start timestamp
    toWlth('0'), //end of cadence1
    toWlth('0'), //end of cadence2
    toWlth('0'), //end of cadence3
    toWlth(((allocation * 1) / 24).toString()), //end of cadence4
    toWlth(((allocation * 2) / 24).toString()), //end of cadence5
    toWlth(((allocation * 3) / 24).toString()), //end of cadence6
    toWlth(((allocation * 4) / 24).toString()), //end of cadence7
    toWlth(((allocation * 5) / 24).toString()), //end of cadence8
    toWlth(((allocation * 6) / 24).toString()), //end of cadence9
    toWlth(((allocation * 7) / 24).toString()), //end of cadence10
    toWlth(((allocation * 8) / 24).toString()), //end of cadence11
    toWlth(((allocation * 9) / 24).toString()), //end of cadence12
    toWlth(((allocation * 10) / 24).toString()), //end of cadence13
    toWlth(((allocation * 11) / 24).toString()), //end of cadence14
    toWlth(((allocation * 12) / 24).toString()), //end of cadence15
    toWlth(((allocation * 13) / 24).toString()), //end of cadence16
    toWlth(((allocation * 14) / 24).toString()), //end of cadence17
    toWlth(((allocation * 15) / 24).toString()), //end of cadence18
    toWlth(((allocation * 16) / 24).toString()), //end of cadence19
    toWlth(((allocation * 17) / 24).toString()), //end of cadence20
    toWlth(((allocation * 18) / 24).toString()), //end of cadence21
    toWlth(((allocation * 19) / 24).toString()), //end of cadence22
    toWlth(((allocation * 20) / 24).toString()), //end of cadence23
    toWlth(((allocation * 21) / 24).toString()), //end of cadence24
    toWlth(((allocation * 22) / 24).toString()), //end of cadence25
    toWlth(((allocation * 23) / 24).toString()), //end of cadence26
    toWlth(allocation.toString()) //end of cadence27
  ]; // Advisors token allocation distribution
}

// last wallet: 0xb6A46ef97A2082E002087Cb1282c94C12b9B3D93
// [0,0,0,0,1041666666666663000000,2083333333333278000000,3125000000000000000000,4166666666666532000000,5208333333333468000000,6250000000000000000000,7291666666666952000000,8333333333333334000000,9375000000000000000000,10416666666666656000000,11458333333333334000000,12500000000000000000000,13541666666666036000000,14583333333333334000000,15625000000000000000000,16666666666666630000000,17708333333333332000000,18750000000000000000000,19791666666666630000000,20833333333333370000000,21875000000000000000000,22916666666666668000000,23958333333330970000000,25000000000000000000000]
