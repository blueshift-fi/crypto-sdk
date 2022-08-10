

export enum WalletErrorCode {
    // shell
    UNSUPPORTED_WALLET,
    NOT_INSTALLED_WALLET,
    NOT_INJECTED_WALLET,
    NOT_CONNECTED_WALLET,
    UNSUPPORTED_METHOD,

    // API interaction
    API_CALL_FAILED,

    // user
    COLLATERAL_IS_MISSING,

    // transaction
    TRANSACTION_BUILDING_FAILED,

    // other
    UNKNOWN
}

export class WalletError extends Error {
    private code: WalletErrorCode;

    constructor(code: WalletErrorCode, message: string) {
        super(message);
        this.name = "Wallet error";
        this.code = code;
    }
}

export const WalletErrors = {
    // shell
    [WalletErrorCode.UNSUPPORTED_WALLET]:
        (name: string) => new WalletError(WalletErrorCode.UNSUPPORTED_WALLET, name + " is unsupported"),
    [WalletErrorCode.NOT_INSTALLED_WALLET]:
        (name: string) => new WalletError(WalletErrorCode.NOT_INSTALLED_WALLET, name + " isn't installed"),
    [WalletErrorCode.NOT_CONNECTED_WALLET]:
        new WalletError(WalletErrorCode.NOT_CONNECTED_WALLET, "wallet isn't connected"),
    [WalletErrorCode.UNSUPPORTED_METHOD]:
        (name: string, method: string) => new WalletError(WalletErrorCode.UNSUPPORTED_METHOD, name + " doesn't support " + method),

    // API call
    [WalletErrorCode.API_CALL_FAILED]:
        (cause: string) => new WalletError(WalletErrorCode.API_CALL_FAILED, cause),

    // user
    // Cardano
    [WalletErrorCode.COLLATERAL_IS_MISSING]:
        new WalletError(WalletErrorCode.COLLATERAL_IS_MISSING, "collateral of wallet is missing"),

    // transaction
    [WalletErrorCode.TRANSACTION_BUILDING_FAILED]:
        (cause: string) => new WalletError(WalletErrorCode.TRANSACTION_BUILDING_FAILED, cause),
    
    // other
    [WalletErrorCode.UNKNOWN]:
        (cause: string) => new WalletError(WalletErrorCode.UNKNOWN, cause),
}
