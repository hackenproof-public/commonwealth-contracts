import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFTVesting, SimpleVesting, StakingGenesisNFTVesting, WhitelistedVesting } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const setVestingsStartTimestamp: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const ONE_MONTH = 2592000;
  const stakingGenesisNftVestingAddress = await getContractAddress(
    hre.network.config.chainId!,
    'StakingGenesisNFTVesting'
  );
  const genesisNftVestingAddress = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTVesting');

  const marketingAddress = '0xcA8310e5fC441f9c7e575C64a8d992F455e6b7BF';
  const strategicPartnersRound1Address = '0x7f44155a0E58384dF4919797Cd5689FeeD667F91';
  const strategicPartnersRound2Address = '0x7Fd2f60b159920d7Dd4544150CE140890052000d';
  const advisoryAddress = '0x34D6aaba93AfEE10fAC35818f9d40FD0F393848E';
  const teamAddress = '0xA02A79793227c368772D934681d84C099c5B8497';
  const treasuryAddress = '0xF4517edA7c64a8b36b8604211fa0b89F3d0Bb285';
  const rewardsAddress = '0xBC9a06cc352e55F2A02e98B4cfAE96eF3dbcE481';

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const startTimestamp = 1717071300;

  if (!startTimestamp) {
    throw new Error('Please define vesting start timestamp');
  }

  const stakingGenesisNftVesting = (await ethers.getContractAt(
    'StakingGenesisNFTVesting',
    stakingGenesisNftVestingAddress,
    wallet
  )) as StakingGenesisNFTVesting;
  const genesisNftVesting = (await ethers.getContractAt(
    'GenesisNFTVesting',
    genesisNftVestingAddress,
    wallet
  )) as GenesisNFTVesting;
  const marketingWhitelistedVesting = (await ethers.getContractAt(
    'WhitelistedVesting',
    marketingAddress,
    wallet
  )) as WhitelistedVesting;
  const strategicPartnersRound1Vesting = (await ethers.getContractAt(
    'WhitelistedVesting',
    strategicPartnersRound1Address,
    wallet
  )) as WhitelistedVesting;
  const strategicPartnersRound2Vesting = (await ethers.getContractAt(
    'WhitelistedVesting',
    strategicPartnersRound2Address,
    wallet
  )) as WhitelistedVesting;
  const advisoryVesting = (await ethers.getContractAt(
    'WhitelistedVesting',
    advisoryAddress,
    wallet
  )) as WhitelistedVesting;
  const teamVesting = (await ethers.getContractAt('WhitelistedVesting', teamAddress, wallet)) as WhitelistedVesting;
  const treasuryVesting = (await ethers.getContractAt('SimpleVesting', treasuryAddress, wallet)) as SimpleVesting;
  const rewardsVesting = (await ethers.getContractAt(
    'WhitelistedVesting',
    rewardsAddress,
    wallet
  )) as WhitelistedVesting;

  console.log('Setting up vestings start timestamp');

  console.log('Setting up StakingGenesisNFTVesting rewards distribution timestamp');
  const stakingGenesisNftVestingTx = await stakingGenesisNftVesting.setDistributionStartTimestamp(startTimestamp);
  await stakingGenesisNftVestingTx.wait();
  console.log('StakingGenesisNFTVesting rewards distribution timestamp is set', stakingGenesisNftVestingTx.hash);

  console.log('Setting up GenesisNFTVesting vesting start timestamp');
  const genesisNftVestingTx = await genesisNftVesting.setVestingStartTimestamp(startTimestamp);
  await genesisNftVestingTx.wait();
  console.log('GenesisNFTVesting vesting start timestamp is set', genesisNftVestingTx.hash);

  console.log('Setting up marketing vesting start timestamp');
  const marketingWhitelistedVestingTx = await marketingWhitelistedVesting.setVestingStartTimestamp(startTimestamp);
  await marketingWhitelistedVestingTx.wait();
  console.log('marketing start timestamp is set', marketingWhitelistedVestingTx.hash);

  console.log('Setting up strategicPartnersRound1 vesting start timestamp');
  const strategicPartnersRound1VestingTx = await strategicPartnersRound1Vesting.setVestingStartTimestamp(
    startTimestamp
  );
  await strategicPartnersRound1VestingTx.wait();
  console.log('strategicPartnersRound1 start timestamp is set', strategicPartnersRound1VestingTx.hash);

  console.log('Setting up strategicPartnersRound2 vesting start timestamp');
  const strategicPartnersRound2VestingTx = await strategicPartnersRound2Vesting.setVestingStartTimestamp(
    startTimestamp
  );
  await strategicPartnersRound2VestingTx.wait();
  console.log('strategicPartnersRound2 start timestamp is set', strategicPartnersRound2VestingTx.hash);

  console.log('Setting up advisors vesting start timestamp');
  const advisoryVestingTx = await advisoryVesting.setVestingStartTimestamp(startTimestamp);
  await advisoryVestingTx.wait();
  console.log('advisors start timestamp is set', advisoryVestingTx.hash);

  console.log('Setting up team vesting start timestamp');
  const teamVestingTx = await teamVesting.setVestingStartTimestamp(startTimestamp);
  await teamVestingTx.wait();
  console.log('team start timestamp is set', teamVestingTx.hash);

  console.log('Setting up treasury vesting start timestamp');
  const treasuryVestingTx = await treasuryVesting.setVestingStartTimestamp(startTimestamp + ONE_MONTH);
  await treasuryVestingTx.wait();
  console.log('treasury start timestamp is set', treasuryVestingTx.hash);

  console.log('Setting up rewards vesting start timestamp');
  const rewardsVestingTx = await rewardsVesting.setVestingStartTimestamp(startTimestamp);
  await rewardsVestingTx.wait();
  console.log('treasury start timestamp is set', rewardsVestingTx.hash);

  console.log('Done');
};

export default setVestingsStartTimestamp;
setVestingsStartTimestamp.tags = ['setVestingsStartTimestamp'];
