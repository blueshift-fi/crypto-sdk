import { Buffer } from "buffer";
import { ethers, Signer } from "ethers";

import BridgeProvider from "../BridgeProvider";

import { awaitTimeout, BufferToHex } from "../../common/util";

import { bridgeConfigs, BridgeName, ChainName } from "../config";

import { Asset, Transaction } from "../../common/types";
import { BridgeResponse } from "../types";

const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE = ethers.BigNumber.from(10).pow(18);

const REQUEST_LIMIT = 100;
const TIMEOUT_LIMIT = 30;
const ERROR = () => new Error("Milkomeda bridge provider error");

const MilkomedaBridgeAbi = require("./MilkomedaBridgeAbi.json");
const IERC20Abi = require("../../common/ethereum/IERC20Abi.json");


class MilkomedaBridgeProvider implements BridgeProvider {
    private static readonly _name = BridgeName.Milkomeda;
    private static readonly _bridgeAbi = MilkomedaBridgeAbi;

    get name() {
        return MilkomedaBridgeProvider._name;
    }

    static get bridgeAbi() {
        return MilkomedaBridgeProvider._bridgeAbi;
    }

    private async request({
        body = null,
        endpoint = "",
        networkId = 0,
        headers = {},
        method = "GET"
    }) {
        const networkEndpoint = networkId == 0 ?
            'https://ada-bridge-devnet-cardano-evm.c1.milkomeda.com/api/v1':
            'https://ada-bridge-mainnet-cardano-evm-us.c1.milkomeda.com/api/v1';

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
        const toCondition = String(txId).startsWith("0x") ? "tx_id" : "mainchain_tx_id";
        const fromCondition = String(txId).startsWith("0x") ? "mainchain_tx_id" : "transaction_id";
        let bridgeInfo = await this.request({
            endpoint: `/requests?${toCondition}=${txId}`,
            networkId: networkId,
            method: "GET"
        });

        // console.log(0, bridgeInfo);

        if (bridgeInfo.requests.length > 0 && bridgeInfo.requests[0][fromCondition] !== "") {
            return bridgeInfo.requests[0][fromCondition];
        }

        for (let i = 1; i < REQUEST_LIMIT; ++i) {
            await awaitTimeout(TIMEOUT_LIMIT * 1000);

            bridgeInfo = await this.request({
                endpoint: `/requests?${toCondition}=${txId}`,
                networkId: networkId,
                method: "GET"
            });

            // console.log(i, bridgeInfo);

            if (bridgeInfo.requests.length > 0 && bridgeInfo.requests[0][fromCondition] !== "") {
                return bridgeInfo.requests[0][fromCondition];
            }
        }

        throw ERROR();
    }

    async bridgeFromEVM(
        asset: Asset,
        from: { chain: ChainName, address: string },
        to: { chain: ChainName, address: string },
        signer: Signer
    ): Promise<BridgeResponse> {
        const bridgeConfig = bridgeConfigs[BridgeName.Milkomeda][from.chain][to.chain];

        if (!bridgeConfig) {
            throw new Error("Bridge config is undefiend");
        }

        const bridgeContract = new ethers.Contract(bridgeConfig.address, MilkomedaBridgeAbi, signer);

        const amount = ethers.BigNumber.from(asset.quantity);

        if (asset.token !== ETH_ADDRESS) {
            const tokenContract = new ethers.Contract(asset.token, IERC20Abi, signer);
            const allowanceAmount: ethers.BigNumber = await tokenContract.allowance(await signer.getAddress(), bridgeConfig.address);

            if (amount.gt(allowanceAmount)) {
                const aproveTx = await tokenContract.connect(signer).approve(bridgeConfig.address, amount);
                await aproveTx.wait();
            }
        }

        const assetId = await bridgeContract.callStatic.findAssetIdByAddress(asset.token);

        const fromTx = await bridgeContract.connect(signer).submitUnwrappingRequest(
            {
                assetId: assetId,
                from: await signer.getAddress(),
                to: "0x" + BufferToHex(Buffer.from(to.address)),
                amount: amount
            },
            {
                value: ONE.add(asset.token !== ETH_ADDRESS ? ONE.mul(3) : amount)
            }
        );

        const targetNetworkId = from.chain === ChainName.Milkomeda ? 1 : 0;
        return {
            from: {
                chain: from.chain,
                tx: {
                    hash: fromTx.hash,
                    wait: async (blockchainProvider = undefined, confirmations = 0) => {
                        return new Promise<string>(async (resolve) => {
                            resolve((await fromTx.wait()).blockHash);
                        })
                    }
                } as Transaction,
                fee: {
                    token: "0x0000000000000000000000000000000000000000",
                    quantity: "1" + "0".repeat(18)
                }
            },
            to: {
                chain: to.chain,
                tx: new Promise<Transaction> (async (resolve) => {
                    const toTxHash: string = await this.getBridgeTxFor(fromTx.hash, targetNetworkId);
                    resolve ({
                        hash: toTxHash,
                        wait: async (blockchainProvider: any, confirmations = 0) => {
                            return new Promise<string>(async (resolve, reject) => {
                                if (blockchainProvider) {
                                    resolve(await blockchainProvider.getTxBlockHash(toTxHash, targetNetworkId));
                                }
                                reject("BlockchainProvider is undefiend");
                            })
                        }
                    });
                }),
                fee: {
                    token: "0x0000000000000000000000000000000000000000",
                    quantity: "1" + "0".repeat(18)
                }
            },
            by: BridgeName.Milkomeda
        };
    }
}


export default MilkomedaBridgeProvider;
