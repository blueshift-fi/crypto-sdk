import { BlockchainProvider } from "../../blockchain";
import BridgeProvider from "../../bridge/BridgeProvider";
import { BridgeName, ChainName } from "../../bridge/types";
import { Asset } from "../../common/types";


export type Transaction = {
    hash: string;
    wait: (blockchainProvider?: any) => Promise<string>;
}

export type BridgeResponse = {
    from: {
        chain: ChainName,
        tx?: Transaction,
        fee: Asset
    },
    to: {
        chain: ChainName,
        tx?: Promise<Transaction>,
        fee: Asset
    },
    by: BridgeName
}

export interface BridgeSupport {
    setBridgeProvider(bridgeProvider: BridgeProvider): void;

    bridge(
        asset: Asset,
        to: {
            address: string,
            chain: ChainName
        },
        by: BridgeName,
        options: {
            isDemo: boolean,
            ttl: number
        }
    ): Promise<BridgeResponse>;
}
