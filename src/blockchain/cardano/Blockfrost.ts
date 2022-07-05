import BlockchainProvider from "../BlockchainProvider";

import { awaitTimeout } from "../../common/util";


const REQUEST_LIMIT = 100;
const TIMEOUT_LIMIT = 20;
const BLOCKFROST_ERROR = () => new Error("Blockfrost error");


/**
 * BlockfrostApiKey:
 * * 0 - testnet
 * * 1 - mainnet
 */
export type BlockfrostApiKey = {
    0: string,
    1: string
}

export class Blockfrost implements BlockchainProvider {
    private blockfrostApiKey: BlockfrostApiKey;
    
    constructor(blockfrostApiKey: BlockfrostApiKey) {
        this.blockfrostApiKey = blockfrostApiKey;
    }

    private async request({
        body = null,
        endpoint = "",
        networkId = 0,
        headers = {},
        method = "GET"
    }) {
        const networkEndpoint = networkId == 0 ?
            'https://cardano-testnet.blockfrost.io/api/v0':
            'https://cardano-mainnet.blockfrost.io/api/v0';
        const blockfrostApiKey = this.blockfrostApiKey[networkId];

        try {
            return await (await fetch(`${networkEndpoint}${endpoint}`, {
                headers: {
                    project_id: blockfrostApiKey,
                    ...headers
                },
                method: method,
                body
            })).json();
        } catch (error) {
            if (error?.status_code != 404) {
                console.error(error);
            }
            return null;
        }
    }

    async getTxBlockHash(txHash: string, networkId = 0): Promise<string> {
        let txInfo = await this.request({
            endpoint: `/txs/${txHash}`,
            networkId: networkId,
            method: "GET"
        });

        // console.log(0, txInfo);

        if (txInfo?.block) {
            return txInfo.block;
        }

        for (let i = 1; i < REQUEST_LIMIT; ++i) {
            await awaitTimeout(TIMEOUT_LIMIT * 1000);

            txInfo = await this.request({
                endpoint: `/txs/${txHash}`,
                networkId: networkId,
                method: "GET"
            });

            // console.log(i, txInfo);

            if (txInfo?.block) {
                return txInfo.block;
            }
        }

        throw BLOCKFROST_ERROR();
    }

    async getBlockConfirmations(blockHash: string, networkId = 0) {
        const blockInfo = await this.request({
            endpoint: `/blocks/${blockHash}`,
            networkId: networkId,
            method: "GET"
        });
        if (!blockInfo) throw BLOCKFROST_ERROR();

        return blockInfo.confirmations as number;
    }

    async getLatestBlock(networkId = 0) {
        const latestBlock = await this.request({
            endpoint: "/blocks/latest",
            networkId: networkId,
            method: "GET"
        });
        if (!latestBlock) throw BLOCKFROST_ERROR();
        return latestBlock;
    }

    async getProtocolParameters(networkId = 0) {
        const latestBlock = await this.getLatestBlock(networkId);
        if (!latestBlock) throw BLOCKFROST_ERROR();

        const epoch = latestBlock.epoch;

        const protocolParameters = await this.request({
            endpoint: `/epochs/${epoch}/parameters`,
            networkId: networkId,
            method: "GET"
        });
        if (!protocolParameters) throw BLOCKFROST_ERROR();
        return protocolParameters;
    }
}
