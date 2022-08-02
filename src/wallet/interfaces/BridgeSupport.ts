import { BridgeProvider, BridgeName, ChainName, BridgeResponse } from "../../bridge";
import { Asset, Transaction } from "../../common/types";


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
