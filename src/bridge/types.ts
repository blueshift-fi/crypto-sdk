import { Asset, Transaction } from '../common/types';
import { BridgeName, ChainName } from './config';

export type BridgeConfig = {
    address: string,
    metadata?: any,
    fee: Asset
}

export type BridgeResponse = {
    from: {
        chain: ChainName,
        tx?: Transaction,
        fee?: Asset
    },
    to: {
        chain: ChainName,
        tx?: Promise<Transaction>,
        fee?: Asset
    },
    by: BridgeName
}
