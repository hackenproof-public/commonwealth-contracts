import { utils } from 'ethers';

export const EVENT_TOPIC_NFT_MINTED = utils.id('Transfer(address,address,uint256)');
export const EVENT_TOPIC_TOKENS_STAKED = utils.id('TokensStaked(address,address,uint256,uint256)');
