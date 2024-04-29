import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { getContractAddress } from '../utils/addresses';

const uniswapSetup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Uniswap pool setup started');
  const { network } = hre;

  const wlthPriceAddress = await getContractAddress(network.config.chainId!, 'UniswapQuoter');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );
  const wlthPrice = await ethers.getContractAt('UniswapWlthPrice', wlthPriceAddress, wallet);
  const wlthAmountToEstimate = 1000000000000; // 1 WLTH

  const tx3 = await wlthPrice.estimateAmountOut(wlthAmountToEstimate);

  console.log('WLTH/ETH price: ', tx3, ' (in this case 1 WLTH is worth 1 ETH) ');

  // const aggregatorV3InterfaceABI = [
  //   {
  //     inputs: [],
  //     name: "decimals",
  //     outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
  //     stateMutability: "view",
  //     type: "function",
  //   },
  //   {
  //     inputs: [],
  //     name: "description",
  //     outputs: [{ internalType: "string", name: "", type: "string" }],
  //     stateMutability: "view",
  //     type: "function",
  //   },
  //   {
  //     inputs: [{ internalType: "uint80", name: "_roundId", type: "uint80" }],
  //     name: "getRoundData",
  //     outputs: [
  //       { internalType: "uint80", name: "roundId", type: "uint80" },
  //       { internalType: "int256", name: "answer", type: "int256" },
  //       { internalType: "uint256", name: "startedAt", type: "uint256" },
  //       { internalType: "uint256", name: "updatedAt", type: "uint256" },
  //       { internalType: "uint80", name: "answeredInRound", type: "uint80" },
  //     ],
  //     stateMutability: "view",
  //     type: "function",
  //   },
  //   {
  //     inputs: [],
  //     name: "latestRoundData",
  //     outputs: [
  //       { internalType: "uint80", name: "roundId", type: "uint80" },
  //       { internalType: "int256", name: "answer", type: "int256" },
  //       { internalType: "uint256", name: "startedAt", type: "uint256" },
  //       { internalType: "uint256", name: "updatedAt", type: "uint256" },
  //       { internalType: "uint80", name: "answeredInRound", type: "uint80" },
  //     ],
  //     stateMutability: "view",
  //     type: "function",
  //   },
  //   {
  //     inputs: [],
  //     name: "version",
  //     outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
  //     stateMutability: "view",
  //     type: "function",
  //   },
  // ];
  // const ethUsdDataFeed = new ethers.Contract(ethUsdDataFeedAddress, aggregatorV3InterfaceABI, wallet);
  // const usdcUsdDataFeed = new ethers.Contract(usdcUsdDataFeedAddress, aggregatorV3InterfaceABI, wallet);

  // console.log("Getting price of WLTH token paired with ETH (1:1 Ratio)... ");

  // const tx2 = await usdcUsdDataFeed.latestRoundData()
  // console.log("USDC/USD price: ", tx2.answer);
  // const usdcUsd = tx2.answer;

  // const tx1 = await ethUsdDataFeed.latestRoundData();
  // console.log("ETH/USD price: ", tx1.answer);
  // const ethUsd = tx1.answer;
};

// // npx hardhat deploy --tags wlthPrice --network baseSepolia --no-compile
export default uniswapSetup;
uniswapSetup.tags = ['wlthPrice'];
