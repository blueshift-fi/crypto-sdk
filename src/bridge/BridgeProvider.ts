import { BridgeName } from "../bridge/config";

import { Asset } from "../common/types";


interface BridgeProvider {
    // get name(): BridgeName;
    getBridgeTxFor(txId: string, networkId: number): Promise<string>;

    // Temporary method
    bridgeFromEVM(
        asset: Asset,
        from: { chain: string, address: string },
        to: { chain: string, address: string },
        signer: any,
        provider: any
    ): Promise<any>;
}

export default BridgeProvider;
