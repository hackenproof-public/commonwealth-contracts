import { ethers } from 'ethers';

const wlthAddress = '0x34ac60166247079687a2D69A526768438F3e66cC';
const usdcAddress = '0x7b34B0D50249142aa3d6F9978790E8c28F52403E';
const wlthDecimals = 18;
const usdcDecimals = 6;
const abi = ['function transfer(address to, uint amount)'];
const signer = new ethers.Wallet('f1a503f2394a2445abc84a65e6a4e28c4496b65b0c6e28a63ad8b924cb1b7232');

const wlth = new ethers.Contract('0x34ac60166247079687a2D69A526768438F3e66cC', abi, signer);
const usdc = new ethers.Contract('0x7b34B0D50249142aa3d6F9978790E8c28F52403E', abi, signer);

//['Genesis NFT Series 1','Genesis NFT Series 2','Public sale','Team','Treasury/Working capital','Rewards and incentives','Exchanges and liquidity','Community fund bootstrap','Advisory','Strategic partners','Burned']
['Marketing', 'NFT Staking Rewards'].forEach(async (bucketName, index) => {
  const wallet = ethers.Wallet.createRandom();

  // await wlth.transfer(wallet.address, ethers.utils.parseUnits("1"+index, "ether"));
  // await usdc.transfer(wallet.address, ethers.utils.parseUnits("1"+index, "ether"));

  console.log('===============================');
  console.log('Bucket: ' + bucketName);
  console.log('Address: ' + wallet.address);
  console.log('PrivateKey: ' + wallet.privateKey);
  console.log('WLTH Balance: ');
  console.log('ETH Balance: ');
  console.log('USDC Balance: ');
});
