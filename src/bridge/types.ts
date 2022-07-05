import { Asset } from '../common/types';

export enum BridgeName {
    Milkomeda = "Milkomeda"
}

export enum ChainName {
    Cardano = "Cardano",
    CardanoTestnet = "Cardano Testnet",

    Milkomeda = "Milkomeda",
    MilkomedaDevnet = "Milkomeda Devnet"
}

export type BridgeConfig = {
    address: string,
    metadata?: any,
    fee: Asset
}
