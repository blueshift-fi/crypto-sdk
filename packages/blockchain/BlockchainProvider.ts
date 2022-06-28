import { ConfirmationsStatus } from './types';


interface BlockchainProvider {
    getProtocolParameters(networkId: number): Promise<any>;

    getLatestBlock(networkId: number): Promise<any>;
    getBlockConfirmations(blockHash: string, networkId: number): Promise<{
        confirmations: number,
        status: ConfirmationsStatus
    }>;

    getTxBlockHash(txHash: string, networkId: number): Promise<string>
}


export default BlockchainProvider;
