import { Signer } from "ethers";
import { BridgeName } from "../bridge/config";

import { Asset } from "../common/types";
import { BridgeResponse } from "./types";


interface BridgeProvider {
    // get name(): BridgeName;
    getBridgeTxFor(txId: string, networkId: number): Promise<string>;

    // Temporary method
    bridgeFromEVM(
        asset: Asset,
        from: { chain: string, address: string },
        to: { chain: string, address: string },
        signer: Signer
    ): Promise<BridgeResponse>;

    bridgeFromEVMExtra(
        assets: {
            gas: string,
            token?: Asset,
        } | {
            gas?: string,
            token: Asset,
        },
        from: { chain: string, address: string },
        to: { chain: string, address: string },
        signer: Signer
    ): Promise<BridgeResponse>;
}

export default BridgeProvider;
