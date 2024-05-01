import { Buffer } from "buffer";
import { BigNumber, ethers, Signer } from "ethers";

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

import MilkomedaBridgeAbi = require("./MilkomedaBridgeAbi.json");
import IERC20Abi = require("../../common/ethereum/IERC20Abi.json");


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
            // console.error(error);
            return null;
        }
    }

    async getBridgeTxFor(txId: string, networkId = 0): Promise<string> {
        let toCondition: string;
        let fromCondition: string;

        if (String(txId).startsWith("0x")) {
            toCondition = "tx_id";
            fromCondition = "mainchain_tx_id";
        } else {
            toCondition = "mainchain_tx_id";
            fromCondition = "transaction_id";
        }

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
    
    async approveForBridge(
        asset: Asset,
        from: { chain: string, address: string },
        to: { chain: string, address: string },
        signer: Signer
    ): Promise<any> {
        const bridgeConfig = bridgeConfigs[BridgeName.Milkomeda][from.chain][to.chain];

        if (!bridgeConfig) {
            throw new Error("Bridge config is undefiend");
        }

        const amount = ethers.BigNumber.from(asset.quantity);

        if (asset.token !== ETH_ADDRESS) {
            const tokenContract = new ethers.Contract(asset.token, IERC20Abi, signer);
            const allowanceAmount: ethers.BigNumber = await tokenContract.allowance(await signer.getAddress(), bridgeConfig.address);

            if (amount.gt(allowanceAmount)) {
                return await tokenContract.connect(signer).approve(bridgeConfig.address, amount, { gasLimit: 1000000 });
            }
        }

        return undefined;
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
                const aproveTx = await tokenContract.connect(signer).approve(bridgeConfig.address, amount, { gasLimit: 1000000 });
                await aproveTx.wait();
            }
        }

        const assetId = await bridgeContract.callStatic.findAssetIdByAddress(asset.token);

        const fromTx = await bridgeContract.connect(signer).submitUnwrappingRequest(
            {
                assetId: assetId,
                from: await signer.getAddress(),
                to: "0x" + BufferToHex(Buffer.from(to.address)),
                amount: asset.token !== ETH_ADDRESS ? amount : amount.sub(ONE)
            },
            {
                gasLimit: 1000000, value: asset.token !== ETH_ADDRESS ? ONE.mul(4) : amount
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

    async bridgeFromEVMExtra(
        assets: {
            gas: string,
            token?: Asset,
        } | {
            gas?: string,
            token: Asset,
        },
        from: { chain: ChainName, address: string },
        to: { chain: ChainName, address: string },
        signer: Signer
    ): Promise<BridgeResponse> {
        const bridgeConfig = bridgeConfigs[BridgeName.Milkomeda][from.chain][to.chain];

        if (!bridgeConfig) {
            throw new Error("Bridge config is undefiend");
        }

        const bridgeContract = new ethers.Contract(bridgeConfig.address, MilkomedaBridgeAbi, signer);

        const gasId = await bridgeContract.callStatic.findAssetIdByAddress(ETH_ADDRESS);

        let gasAmount: BigNumber;
        let assetAmount: BigNumber;

        let fromTx;

        if (assets?.token) {
            assetAmount = ethers.BigNumber.from(assets.token.quantity);

            const assetId = await bridgeContract.callStatic.findAssetIdByAddress(assets.token.token);

            const tokenContract = new ethers.Contract(assets.token.token, IERC20Abi, signer);
            const allowanceAmount: ethers.BigNumber = await tokenContract.allowance(await signer.getAddress(), bridgeConfig.address);

            if (assetAmount.gt(allowanceAmount)) {
                const aproveTx = await tokenContract.connect(signer).approve(bridgeConfig.address, assetAmount, { gasLimit: 1000000 });
                await aproveTx.wait();
            }

            let value: BigNumber;

            if (assets?.gas) {
                gasAmount = ethers.BigNumber.from(assets.gas);

                if (!gasAmount.gte(ONE.mul(3))) {
                    throw new Error("Gas must be equal or more then 3");
                }

                value = gasAmount.add(ONE);
            } else {
                value = ONE.mul(4);
            }

            fromTx = await bridgeContract.connect(signer).submitUnwrappingRequest(
                {
                    assetId: assetId,
                    from: await signer.getAddress(),
                    to: "0x" + BufferToHex(Buffer.from(to.address)),
                    amount: assetAmount
                },
                {
                    gasLimit: 1000000,
                    value: value
                }
            );
        } else {
            gasAmount = ethers.BigNumber.from(assets.gas);

            if (!gasAmount.gte(ONE.mul(3))) {
                throw new Error("Gas must be equal or more then 3");
            }

            fromTx = await bridgeContract.connect(signer).submitUnwrappingRequest(
                {
                    assetId: gasId,
                    from: await signer.getAddress(),
                    to: "0x" + BufferToHex(Buffer.from(to.address)),
                    amount: gasAmount
                },
                {
                    gasLimit: 1000000,
                    value: gasAmount.add(ONE)
                }
            );
        }

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
