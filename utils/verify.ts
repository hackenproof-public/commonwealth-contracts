import { run } from 'hardhat';

const verify = async (contractAddress: string, args: any[] = []) => {
  console.log('Verifying contract....');
  try {
    await run('verify:verify', {
      noCompile: true,
      address: contractAddress,
      constructorArguments: args
    });
    console.log('Verification successed!');
  } catch (e: any) {
    if (e.message.toLowerCase().includes('already verified')) {
      console.log('Already verified!');
    } else {
      console.log(e);
    }
  }
};

export default verify;
