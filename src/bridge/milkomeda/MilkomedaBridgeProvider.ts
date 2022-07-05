import BridgeProvider from "../BridgeProvider";

import { awaitTimeout } from "../../common/util";


const REQUEST_LIMIT = 100;
const TIMEOUT_LIMIT = 20;
const ERROR = () => new Error("Milkomeda bridge provider error");


class MilkomedaBridgeProvider implements BridgeProvider {
    private async request({
        body = null,
        endpoint = "",
        networkId = 0,
        headers = {},
        method = "GET"
    }) {
        const networkEndpoint = networkId == 0 ?
            'https://ada-bridge-devnet-cardano-evm.c1.milkomeda.com/api/v1':
            'https://ada-bridge-mainnet-cardano-evm.c1.milkomeda.com/api/v1';

        try {
            return await (await fetch(`${networkEndpoint}${endpoint}`, {
                headers: {
                    ...headers
                },
                method: method,
                body
            })).json();
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    async getBridgeTxFor(txId: string, networkId = 0): Promise<string> {
        const condition = txId.startsWith("0x") ? "transaction_id" : "mainchain_tx_id";
        let bridgeInfo = await this.request({
            endpoint: `/requests?${condition}=${txId}`,
            networkId: networkId,
            method: "GET"
        });

        // console.log(0, bridgeInfo);

        if (bridgeInfo.requests.length > 0) {
            return bridgeInfo.requests[0]?.transaction_id;
        }

        for (let i = 1; i < REQUEST_LIMIT; ++i) {
            await awaitTimeout(TIMEOUT_LIMIT * 1000);

            bridgeInfo = await this.request({
                endpoint: `/requests?${condition}=${txId}`,
                networkId: networkId,
                method: "GET"
            });

            // console.log(i, bridgeInfo);

            if (bridgeInfo.requests.length > 0) {
                return bridgeInfo.requests[0]?.transaction_id;
            }
        }

        throw ERROR();
    }
}


export default MilkomedaBridgeProvider;
