import BridgeProvider from "../../bridge/BridgeProvider";
import { BridgeName, ChainName } from "../../bridge/types";
import { Asset } from "../../common/types";


interface BridgeSupport {
    setBridgeProvider(bridgeProvider: BridgeProvider): void;

    bridge(
        // amount: string,
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
    ): Promise<{
        from: {
            chain: ChainName,
            txHash: string,
            fee: {
                token: string,
                quantity: string,
                decimals: number
            }
        },
        to: {
            chain: ChainName,
            txHash: Promise<string>,
            fee: {
                token: string,
                quantity: string,
                decimals: number
            }
        },
        by: BridgeName
    }>;
}


export default BridgeSupport;
