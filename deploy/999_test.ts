import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { GenesisNFT } from '../typechain-types';

//This scrip needs to be run separetly for every tier
const airdropFreeFundNfts: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  // const provider = ethers.getDefaultProvider();
  // const wallet = new Wallet('f1a503f2394a2445abc84a65e6a4e28c4496b65b0c6e28a63ad8b924cb1b7232', provider);
  // const provider = new ethers.providers.JsonRpcProvider(
  //   'https://nd-277-748-957.p2pify.com/20d0cff56526225a96d634a9bc0226b4'
  // );
  const genesisNFT = (await ethers.getContractAt(
    'GenesisNFT',
    '0xAE2DfbDDEF17998a638b26B38AAfD7e4625cA41A'
  )) as GenesisNFT;

  //   const value = await genesisNFT.estimateGas.burn(8);

  //   await genesisNFT.connect(wallet).mint(wallet.address, 10)
  //   console.log("Test");
  //   console.log(await genesisNFT.ownerOf(8));
  //   console.log("Test 2");
  //   const owner = await genesisNFT.ownerOf(8);

  //   const price = await provider.getGasPrice();

  //   console.log(price.toString());
  //   console.log('price:', price.toString());
  //   const v = value.toNumber()  * 36584555118;
  //   console.log(ethers.utils.formatEther(v.toString()));
  //   console.log(ethers.utils.parseEther(v.toString()).toString());

  //   console.log('value:', value.toString());
  // };
  // const provider = ethers.getDefaultProvider();
  const provider = new ethers.providers.JsonRpcProvider(
    'https://eth-mainnet.g.alchemy.com/v2/STmaoEYiJ6TPXyYJgVaWAxumyRWxv2xm'
  );

  const data: any = { owners: [] };

  let counter = 0;
  try {
    for (let i = 0; i < 1; i++) {
      let owner = await genesisNFT.ownerOf(i);
      console.log(`Owner ${owner} of token: ${i}`);

      // if (owner === '0xAB14624691d0D1b62F9797368104Ef1F8C20dF83') {
      //   continue;
      // } else {
      const code = await provider.getCode('0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63');
      if (code !== '0x') {
        console.log(`Owner ${owner} of token: ${i} has code`);
        data.owners.push({ owner, token: i });
        counter++;
        // }
      }
    }
    console.log(counter);
    //   const code = await provider.getCode('0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63');
  } catch (error) {}
  console.log(counter);

  // fs.writeFileSync('myjsonfile.json', JSON.stringify(data, null, 2), 'utf8');

  //0.8279796850816008
  //0.3805478595143809
  //0.19080504930054506
  //0.8279796850816008 + 0.2349216515143809 + 0.19080504930054506 = 1.2537063858965268
};
export default airdropFreeFundNfts;
airdropFreeFundNfts.tags = ['test'];
