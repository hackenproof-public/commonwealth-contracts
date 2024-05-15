import { NonceManager } from '@ethersproject/experimental';
import { constants } from 'ethers';
import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { toWlth } from '../test/utils';
import { WhitelistedVesting } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

let vestingAddress = constants.AddressZero!;

const rewardsSetup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();
  const ONE_MONTH = 2592000;
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const ownerWallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );
  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');

  const vestingParameters = {
    gamification: false,
    beneficiary: deploymentConfig.communityFundWallet,
    allocation: 50000000,
    duration: ONE_MONTH * 34,
    cadence: ONE_MONTH,
    vestingStartTimestamp: Math.floor(Date.now() / 1000) + ONE_MONTH // TODO
  };

  const parameters = [
    { name: '_gamification', value: vestingParameters.gamification },
    { name: '_owner', value: deploymentConfig.ownerAccount },
    { name: '_wlth', value: wlth },
    { name: '_communityFund', value: deploymentConfig.communityFundWallet },
    { name: '_allocation', value: toWlth(vestingParameters.allocation.toString()) },
    { name: '_duration', value: vestingParameters.duration },
    { name: '_cadence', value: vestingParameters.cadence },
    { name: '_leftoversUnlockDelay', value: deploymentConfig.genesisNftVestingLeftoversUnlockDelay },
    { name: '_vestingStartTimestamp', value: vestingParameters.vestingStartTimestamp },
    { name: '_tokenReleaseDistribution', value: tokenDistribution(vestingParameters.allocation) }
  ];

  const vesting = await deploy(hre, 'WhitelistedVesting', parameters, false);
  vestingAddress = vesting?.address!;

  await whitelistedWalletSetup(
    vestingAddress,
    vestingParameters.beneficiary,
    vestingParameters.allocation,
    ownerWallet
  );
  console.log('Done');
};

export default rewardsSetup;
rewardsSetup.tags = ['tge', 'rewardsSetup', 'all'];

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
  // 5% unlock, 12 month linear vest
  return [
    toWlth(((allocation * 5) / 100).toString()), //vesting start timestamp
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 1) / 1200).toString()), //end of cadence1
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 2) / 1200).toString()), //end of cadence2
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 3) / 1200).toString()), //end of cadence3
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 4) / 1200).toString()), //end of cadence4
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 5) / 1200).toString()), //end of cadence5
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 6) / 1200).toString()), //end of cadence6
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 7) / 1200).toString()), //end of cadence7
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 8) / 1200).toString()), //end of cadence8
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 9) / 1200).toString()), //end of cadence9
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 10) / 1200).toString()), //end of cadence10
    toWlth(((allocation * 5) / 100 + (allocation * 95 * 11) / 1200).toString()), //end of cadence11
    toWlth(allocation.toString()) //end of cadence12
  ]; // rewards token allocation distribution
}
