import { constants, utils } from 'ethers';

export const BP_MAX = 10000; // basis points maximum value
export const DEFAULT_TRANSACTION_FEE = 100;

// Events
export const EVENT_TOPIC_NFT_MINTED = utils.id('Transfer(address,address,uint256)');
export const EVENT_TOPIC_TOKENS_STAKED = utils.id('TokensStaked(address,address,uint256,uint256)');

// Roles
export const DEFAULT_ADMIN_ROLE = constants.HashZero;
export const BURNER_ROLE = utils.keccak256(utils.toUtf8Bytes('BURNER_ROLE'));
