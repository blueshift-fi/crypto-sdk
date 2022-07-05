const WalletErrorMessage = {
    UNSUPPORTED_WALLET:
        (name: string) => name + " is unsupported",
    NOT_INSTALLED_WALLET:
        (name: string) => name + " isn't installed",
    NOT_CONNECTED_WALLET:
        (name: string) => name + " isn't connected",
    UNSUPPORTED_METHOD:
        (name: string, method: string) => name + " doesn't support " + method,
    COLLATERAL_IS_MISSING:
        "collateral of wallet is missing",
}

export default WalletErrorMessage;
