import { BridgeName, ChainName, BridgeConfig } from "./types"


export const bridgeConfigs = {
    [BridgeName.Milkomeda]: {
        [ChainName.Cardano]: {
            [ChainName.Milkomeda]: {
                address: "addr1w8pydstdswmdqmg2rdt59dzql3zgfp9pt8sulnjgalycwdsj9js7w",
                metadata: (addr: string) => {
                    return {
                        87: "mainnet.cardano-evm.c1",
                        88: addr
                    }
                },
                fee: {
                    to: {
                        token: "milkADA",
                        quantity: "100000000000000000",
                        decimals: 18
                    }
                }
            } as BridgeConfig
        },
        [ChainName.CardanoTestnet]: {
            [ChainName.MilkomedaDevnet]: {
                address: "addr_test1wz6lvjg3anml96vl22mls5vae3x2cgaqwy2ewp5gj3fcxdcw652wz",
                metadata: (addr: string) => {
                    return {
                        87: "devnet.cardano-evm.c1",
                        88: addr
                    }
                },
                fee: {
                    to: {
                        token: "milkTADA",
                        quantity: "100000000000000000",
                        decimals: 18
                    }
                }
            } as BridgeConfig
        }
    }
}
