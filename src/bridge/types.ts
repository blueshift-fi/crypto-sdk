import { Asset } from '../common/types';

export type BridgeConfig = {
    address: string,
    metadata?: any,
    fee: Asset
}
