

export type Asset = {
    token: string,
    quantity: string,
    decimals?: number
}

export type Transaction = {
    hash: string;
    wait: (blockchainProvider?: any, confirmations?: number) => Promise<string>;
}
