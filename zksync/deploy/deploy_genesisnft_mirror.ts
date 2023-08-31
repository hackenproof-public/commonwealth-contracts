import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { utils, Wallet } from 'zksync-web3';

import * as dotenv from 'dotenv';
import { env } from 'process';

dotenv.config();

const WALLET_PRIVATE_KEY = env.WALLET_PRIVATE_KEY as string;
const GOVERNING_GENESISNFT_ADDRESS = env.GOVERNING_GENESISNFT_ADDRESS as string;
const OWNER = '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63';

const CONSTRUCTOR_ARGS = [utils.applyL1ToL2Alias(OWNER), utils.applyL1ToL2Alias(GOVERNING_GENESISNFT_ADDRESS), [], []];

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(WALLET_PRIVATE_KEY);

  const deployer = new Deployer(hre, wallet);
  const artifact = await deployer.loadArtifact('GenesisNFTmirror');

  // // optional: use ETH to bridge funds onto the zkSync to be able to hande deployment cost
  // const deploymentFee = await deployer.estimateDeployFee(artifact, CONSTRUCTOR_ARGS);
  // console.log(`Estimated deploy fee: ${deploymentFee}`);
  // const depositHandle = await deployer.zkWallet.deposit({
  //     to: deployer.zkWallet.address,
  //     token: utils.ETH_ADDRESS,
  //     amount: deploymentFee.mul(2), // twice the deployment fee to have a wiggle room
  // });
  //
  // console.log(`Depositing funds to zkSync...`);
  // await depositHandle.wait();

  console.log(`Constructor params: ${JSON.stringify(CONSTRUCTOR_ARGS)}`);
  console.log(`Deploying GenesisNFTmirror contract...`);
  // Deploy this contract. The returned object will be of a `Contract` type, similar to the ones in `ethers`.
  // The address of the governance is an argument for contract constructor.
  const mirrorGenesisNFTcontract = await deployer.deploy(artifact, CONSTRUCTOR_ARGS);

  // Show the contract info.
  const contractAddress = mirrorGenesisNFTcontract.address;
  console.log(`${artifact.contractName} was deployed to ${contractAddress}`);
}
