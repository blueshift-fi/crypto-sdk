import BridgeProvider from "../../bridge/BridgeProvider";
import { BridgeName, ChainName } from "../../bridge/types";
import { Asset } from "../../common/types";


export type BridgeResponse = {
    from: {
        chain: ChainName,
        txHash: string,
        fee: Asset
    },
    to: {
        chain: ChainName,
        txHash: Promise<string>,
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
