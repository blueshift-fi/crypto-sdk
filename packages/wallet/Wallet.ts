

interface Wallet {
    /* MAIN OPTIONS */
    getAvailableNames(): string[];

    login(walletName: string): void;

    // TODO: think about logout
    // logout(): void;


    /* WALLET INFO */

    apiVersion(): Promise<string>;
    name(): Promise<string>;
    icon(): Promise<string>;

    /**
     * Returns the network id of the currently connected account.
     *  - 0 - Testnet;
     *  - 1 - Mainnet.
     */
    getNetworkId(): Promise<number>;


    /* ACCOUNT INFO */

    getUsedAddresses(): Promise<string[]>

    getBalance(): Promise<any>;

    /**
     * Token examples:
     * * "lovelace"
     * * "fda1b6b487bee2e7f64ecf24d24b1224342484c0195ee1b7b943db50.tBLUES"
     * * "e043fd7b2076ea9e1b279d200b59e153bf6b299a72ce6e2c14aeb.BLUES"
     */
    getBalanceToken(token: string): Promise<string>;


    /* TRANSACTION HANDLING */

    /* EVENT HANDLING */

    /**
     * Register events coming from Wallet.
     * Available events are:
     *  - accountChange: ((addresses : [BaseAddress]) => void)
     *  - networkChange: ((network : number) => void)
     */
    on(eventName: string, callback: any): void;

    /**
     * Deregister events coming from Wallet.
     * Available events are:
     *  - accountChange: ((addresses : [BaseAddress]) => void)
     *  - networkChange: ((network : number) => void)
     */
    off(eventName: string, callback: any): void;
}


export default Wallet;
