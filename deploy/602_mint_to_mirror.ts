import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract, Provider, utils } from 'zksync-web3';
import MIRROR_ABI from '../artifacts/contracts/GenesisNFTmirror.sol/GenesisNFTmirror.json';
import NFT_ABI from '../artifacts/contracts/GenesisNFTV1.sol/GenesisNFTV1.json';

const upgradeBridge: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  // const GEN1NFT_ADDRESS = '0x71Aab3eF918292CA4ff0ffab060fF17515d8ff91';
  // const MIRROR_ADDRESS = '0xc628ba69423839E1F1A1fD90E167Df5B3288C000';

  //
  const GEN1NFT_ADDRESS = '0xfFD89A3F528D8808456E1617A29561a30Dd8FC36';
  const MIRROR_ADDRESS = '0xD240675DafAcc5401D1Db0d1292a5Bf9Db39936A';
  const l1Provider = new ethers.providers.JsonRpcProvider('');
  // Set up the Governor wallet to be the same as the one that deployed the governance contract.
  const wallet = new ethers.Wallet('', l1Provider);
  // Set a constant that accesses the Layer 1 contract.
  const nftV1 = new Contract(GEN1NFT_ADDRESS, NFT_ABI.abi, wallet);

  const l2Provider = new Provider('https://testnet.era.zksync.dev');
  // Get the current address of the zkSync L1 bridge.
  const zkSyncAddress = await l2Provider.getMainContractAddress();
  // Get the `Contract` object of the zkSync bridge.
  const zkSyncContract = new Contract(zkSyncAddress, utils.ZKSYNC_MAIN_ABI, wallet);

  const mirrorInterface = new ethers.utils.Interface(MIRROR_ABI.abi);
  const data = mirrorInterface.encodeFunctionData('moveToken', [1, '']);

  const gasPrice = await l1Provider.getGasPrice();

  // Define a constant for gas limit which estimates the limit for the L1 to L2 transaction.
  const gasLimit = await l2Provider.estimateL1ToL2Execute({
    contractAddress: MIRROR_ADDRESS,
    calldata: data,
    caller: utils.applyL1ToL2Alias(GEN1NFT_ADDRESS)
  });

  const baseCost = await zkSyncContract.l2TransactionBaseCost(
    gasPrice,
    gasLimit,
    utils.REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT
  );

  console.log(baseCost);

  for (let i = 0; i < 1; i++) {
    const tx = await nftV1.mintNotify('', 1, gasLimit, {
      // Pass the necessary ETH `value` to cover the fee for the operation
      value: baseCost,
      gasPrice: 10000000000
    });

    console.log(tx.hash);

    // await tx.wait();
  }
  console.log('Done');

  // const l2Response = await l2Provider.getL2TransactionFromPriorityOp(tx);

  // // Output the receipt of the L2 transaction corresponding to the call to the counter contract.
  // const l2Receipt = await l2Response.wait();
  // console.log(l2Receipt);
};

export default upgradeBridge;

upgradeBridge.tags = ['mirrorMint'];
