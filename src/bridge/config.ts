import { BridgeConfig } from "./types";

export enum BridgeName {
    Milkomeda = "Milkomeda"
}

export enum ChainName {
    Cardano = "Cardano",
    CardanoTestnet = "Cardano Testnet",

    Milkomeda = "Milkomeda",
    MilkomedaDevnet = "Milkomeda Devnet"
}

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
                    token: "0x0000000000000000000000000000000000000000",  // milkADA
                    quantity: "100000000000000000",
                    decimals: 18
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
                    token: "0x0000000000000000000000000000000000000000", // milkTADA
                    quantity: "100000000000000000",
                    decimals: 18
                }
            } as BridgeConfig
        },
        [ChainName.Milkomeda]: {
            [ChainName.Cardano]: {
                address: "0xD0Fab4aE1ff28825aabD2A16566f89EB8948F9aB",
                fee: {
                    token: "0x0000000000000000000000000000000000000000", // milkADA
                    quantity: "1000000000000000000",
                    decimals: 18
                }
            } as BridgeConfig
        },
        [ChainName.MilkomedaDevnet]: {
            [ChainName.CardanoTestnet]: {
                address: "0x319f10d19e21188ecF58b9a146Ab0b2bfC894648",
                fee: {
                    token: "0x0000000000000000000000000000000000000000", // milkTADA
                    quantity: "1000000000000000000",
                    decimals: 18
                }
            } as BridgeConfig
        }
    }
};
