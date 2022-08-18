import Loader from "../Loader";

export function inspectCardanoAddress(addr: string) {
    let info: { type: string, networkId: number } | undefined;

    try {
        const addressShelley = Loader.CSL.Address.from_bech32(addr);

        info = { 
            type: "Shelley",
            networkId: addressShelley.network_id()
        }

    } catch(err) {
        try {
            const addressByron = Loader.CSL.ByronAddress.from_base58(addr);

            info = { 
                type: "Byron",
                networkId: addressByron.network_id()
            }
        } catch(err) {
            console.warn("Unknown address");
        }
    }

    return info;
}
