

interface BridgeProvider {
    getBridgeTxFor(txId: string, networkId: number): Promise<string>;
}

export default BridgeProvider;
