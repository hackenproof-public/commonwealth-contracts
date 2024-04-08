// import { ethers } from 'hardhat';
// import { DeployFunction } from 'hardhat-deploy/dist/types';
// import { HardhatRuntimeEnvironment } from 'hardhat/types';
// import { Contract, Provider, utils } from 'zksync-web3';
// import LOCK_ABI from '../artifacts/contracts/GenesisNFTLock.sol/GenesisNFTLock.json';
// import MIRROR_ABI from '../artifacts/contracts/GenesisNFTmirror.sol/GenesisNFTmirror.json';
// import NFT_ABI from '../artifacts/contracts/GenesisNFTV1.sol/GenesisNFTV1.json';
// import { getContractAddress } from '../utils/addresses';

// import { l1Tol2 } from '../helper-hardhat-config';
// import { getEnvByNetwork } from '../scripts/utils';
// import { GenesisNFT } from '../typechain-types/contracts/GenesisNFT.sol/GenesisNFT';
// import { GenesisNFTLock } from '../typechain-types/contracts/GenesisNFTLock';

// const upgradeBridge: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
//   const chainId = hre.network.config.chainId!;
//   const LOCK_ADDRESS = await getContractAddress(chainId, 'GenesisNFTLock');
//   const MIRROR_ADDRESS = await getContractAddress(l1Tol2[chainId].chainId, 'GenesisNFTV1Mirror');
//   const GENESIS_NFT_ADDRESS = await getContractAddress(chainId, 'GenesisNFTV1');

//   //
//   const l1Rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

//   const l1Provider = new ethers.providers.JsonRpcProvider(l1Rpc);
//   // Set up the Governor wallet to be the same as the one that deployed the governance contract.

//   const wallet = new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, l1Provider);

//   // Set a constant that accesses the Layer 1 contract.
//   const nftV1 = new Contract(GENESIS_NFT_ADDRESS, NFT_ABI.abi, wallet) as GenesisNFT;
//   const lock = new Contract(LOCK_ADDRESS, LOCK_ABI.abi, wallet) as GenesisNFTLock;

//   const approveTx = await nftV1.setApprovalForAll(LOCK_ADDRESS, true);
//   await approveTx.wait();
//   console.log('Approved');
//   const l2Rpc = getEnvByNetwork('RPC_URL', l1Tol2[hre.network.config.chainId!].name)!;

//   const l2Provider = new Provider(l2Rpc);
//   // Get the current address of the zkSync L1 bridge.
//   const zkSyncAddress = await l2Provider.getMainContractAddress();
//   // Get the `Contract` object of the zkSync bridge.
//   const zkSyncContract = new Contract(zkSyncAddress, utils.ZKSYNC_MAIN_ABI, wallet);

//   const mirrorInterface = new ethers.utils.Interface(MIRROR_ABI.abi);
//   const data = mirrorInterface.encodeFunctionData('assign', [
//     [0, 1, 2, 3, 4, 5],
//     '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63'
//   ]);
//   // const data = mirrorInterface.encodeFunctionData('unassign', [
//   //   [
//   //     3, 4, 261
//   //   ],
//   //   '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63'
//   // ]);

//   const gasPrice = await l1Provider.getGasPrice();

//   // Define a constant for gas limit which estimates the limit for the L1 to L2 transaction.
//   const gasLimit = await l2Provider.estimateL1ToL2Execute({
//     contractAddress: MIRROR_ADDRESS,
//     calldata: data,
//     caller: utils.applyL1ToL2Alias(LOCK_ADDRESS)
//   });

//   const baseCost = await zkSyncContract.l2TransactionBaseCost(
//     gasPrice.mul(2),
//     gasLimit,
//     utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
//   );

//   console.log(baseCost);

//   const tx = await lock.lockSeries1Tokens([0, 1, 2, 3, 4, 5], '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63', gasLimit, {
//     // Pass the necessary ETH `value` to cover the fee for the operation
//     value: baseCost,
//     gasPrice: gasPrice
//   });

//   console.log(tx);

//   // const tx = await lock.unlockSeries1Tokens(   [
//   //   3, 4, 261
//   // ], gasLimit, {
//   //   // Pass the necessary ETH `value` to cover the fee for the operation
//   //   value: baseCost,
//   //   gasPrice: gasPrice
//   // });

//   console.log(tx.hash);
//   // console.log(tx);

//   await tx.wait();

//   console.log('Done');

//   console.log(new Date().getTime() / 1000);

//   const l2Response = await l2Provider.getL2TransactionFromPriorityOp(tx);

//   // // Output the receipt of the L2 transaction corresponding to the call to the counter contract.
//   const l2Receipt = await l2Response.wait();
//   console.log(new Date().getTime() / 1000);
// };

// export default upgradeBridge;
// upgradeBridge.tags = ['mirrorMint'];
