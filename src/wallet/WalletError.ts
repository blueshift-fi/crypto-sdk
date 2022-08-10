export enum ErrorCode {
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
    private code: ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.name = "Wallet error";
        this.code = code;
    }
}

export const WalletErrors = {
    // shell
    [ErrorCode.UNSUPPORTED_WALLET]:
        (name: string) => new WalletError(ErrorCode.UNSUPPORTED_WALLET, name + " is unsupported"),
    [ErrorCode.NOT_INSTALLED_WALLET]:
        (name: string) => new WalletError(ErrorCode.NOT_INSTALLED_WALLET, name + " isn't installed"),
    [ErrorCode.NOT_CONNECTED_WALLET]:
        new WalletError(ErrorCode.NOT_CONNECTED_WALLET, "wallet isn't connected"),
    [ErrorCode.UNSUPPORTED_METHOD]:
        (name: string, method: string) => new WalletError(ErrorCode.UNSUPPORTED_METHOD, name + " doesn't support " + method),

    // API call
    [ErrorCode.API_CALL_FAILED]:
        (cause: string) => new WalletError(ErrorCode.API_CALL_FAILED, cause),

    // user
    // Cardano
    [ErrorCode.COLLATERAL_IS_MISSING]:
        new WalletError(ErrorCode.COLLATERAL_IS_MISSING, "collateral of wallet is missing"),

    // transaction
    [ErrorCode.TRANSACTION_BUILDING_FAILED]:
        (cause: string) => new WalletError(ErrorCode.TRANSACTION_BUILDING_FAILED, cause),
    
    // other
    [ErrorCode.UNKNOWN]:
        (cause: string) => new WalletError(ErrorCode.UNKNOWN, cause),
    
    
}
