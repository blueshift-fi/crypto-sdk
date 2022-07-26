import BridgeProvider from "../../bridge/BridgeProvider";
import { BridgeName, ChainName } from "../../bridge/config";
import { Asset, Transaction } from "../../common/types";


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
