import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { UniswapWlthPriceOracle } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const getPrice: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Uniswap pool setup started');
  const { network } = hre;

  const wlthPriceOracleAddress = await getContractAddress(network.config.chainId!, 'UniswapWlthPriceOracle');

  const signer = ethers.provider.getSigner();
  const wlthPrice = (await ethers.getContractAt(
    'UniswapWlthPriceOracle',
    wlthPriceOracleAddress,
    signer
  )) as UniswapWlthPriceOracle;

  const wlthAmountToEstimate = ethers.utils.parseEther('1'); // 1 WLTH

  console.log(await wlthPrice.estimateAmountOut(wlthAmountToEstimate));
};
export default getPrice;
getPrice.tags = ['getPrice'];
