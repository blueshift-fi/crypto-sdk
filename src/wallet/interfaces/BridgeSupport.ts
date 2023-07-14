import { BridgeProvider, BridgeName, ChainName, BridgeResponse } from "../../bridge";
import { Asset, Transaction } from "../../common/types";


export interface BridgeSupport {
    setBridgeProvider(bridgeProvider: BridgeProvider): void;

    bridge(
        assets: {
            gas: string,
            tokens?: Asset[],
        } | {
            gas?: string,
            tokens: Asset[],
        },
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
