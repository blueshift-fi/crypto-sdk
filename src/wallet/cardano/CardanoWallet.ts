import Wallet from "../Wallet";
import WalletErrorMessage from "../WalletErrorMessage";

import Loader from "../../common/Loader";
import CoinSelection from "../../common/cardano/CoinSelection";
import BlockchainProvider from "../../blockchain/interfaces/BlockchainProvider";
import BridgeProvider from "../../bridge/BridgeProvider";
import { BridgeResponse, BridgeSupport, Transaction } from "../interfaces/BridgeSupport";

import { Asset } from "../../common/types";
import { CardanoAsset } from "./types";

import { Buffer } from "buffer";
import { AsciiToHex, BufferToHex, HexToBuffer } from "../util";
import { BridgeName, ChainName } from "../../bridge/types";
import { bridgeConfigs } from "../../bridge/config";

import { CardanoWalletName } from "./config";


const SUPPORTED_WALLETS = [
    CardanoWalletName.NAMI,
    CardanoWalletName.FLINT,
    CardanoWalletName.CARDWALLET
]

const EXPERIMENTAL_WALLETS = [
    CardanoWalletName.ETERNL,
    CardanoWalletName.TYPHON,
    CardanoWalletName.YOROI
]

const UNSUPPORTED_WALLETS = [
    CardanoWalletName.GEROWALLET
]

const LANGUAGE_VIEWS = "a141005901d59f1a000302590001011a00060bc719026d00011a000249f01903e800011a000249f018201a0025cea81971f70419744d186419744d186419744d186419744d186419744d186419744d18641864186419744d18641a000249f018201a000249f018201a000249f018201a000249f01903e800011a000249f018201a000249f01903e800081a000242201a00067e2318760001011a000249f01903e800081a000249f01a0001b79818f7011a000249f0192710011a0002155e19052e011903e81a000249f01903e8011a000249f018201a000249f018201a000249f0182001011a000249f0011a000249f0041a000194af18f8011a000194af18f8011a0002377c190556011a0002bdea1901f1011a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000242201a00067e23187600010119f04c192bd200011a000249f018201a000242201a00067e2318760001011a000242201a00067e2318760001011a0025cea81971f704001a000141bb041a000249f019138800011a000249f018201a000302590001011a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a00330da70101ff";


class CardanoWallet implements Wallet, BridgeSupport {
    public static readonly supportedWallets = SUPPORTED_WALLETS;
    public static readonly experimentalWallets = EXPERIMENTAL_WALLETS;

    private wallet: any;
    private walletApi: any;
    private walletAuth: any;
    private walletName: CardanoWalletName | undefined;

    private blockchainProvider: BlockchainProvider | undefined;
    private bridgeProvider: BridgeProvider | undefined;

    constructor(blockchainProvider: BlockchainProvider | undefined = undefined) {
        if (blockchainProvider) {
            this.blockchainProvider = blockchainProvider;
        }
    }

    setBlockchainProvider(blockchainProvider: BlockchainProvider) {
        this.blockchainProvider = blockchainProvider;
    }

    setBridgeProvider(bridgeProvider: BridgeProvider) {
        this.bridgeProvider = bridgeProvider;
    }

    getAvailableNames() {
        if ((window as any).cardano === undefined) {
            console.error("Cardano API not found");
            return [];
        }

        const names: string[] = [];
        for (const name of [...SUPPORTED_WALLETS, ...EXPERIMENTAL_WALLETS]) {
            if ((window as any).cardano[name]) {
                names.push(name);
            }
        }
        return names;
    }

    async getNetworkId() {
        // if (!await this.isEnabled()) {
        //     throw WalletErrorMessage.NOT_CONNECTED_WALLET(this.walletName);
        // }

        let networkId = -1;

        switch(this.walletName) {
            case CardanoWalletName.YOROI:
                const cborAddresses = await this._getCborUsedAddresses();
                console.log(cborAddresses);
                console.log(cborAddresses[0]);
                networkId = Loader.CSL.Address.from_bytes(
                    HexToBuffer(cborAddresses[0])
                ).network_id() as number;
                break;

            default:
                networkId = await this.walletApi.getNetworkId() as number;
                break;
        }
        
        return networkId;
    }

    apiVersion() {
        return this.wallet ? this.wallet.apiVersion : null;
    }

    name() {
        return this.wallet ? this.wallet.name : null;
    }

    icon() {
        return this.wallet ? this.wallet.icon : null;
    }

    async isEnabled() {
        return this.wallet && (await this.wallet.isEnabled()) && this.walletApi;
    }

    private async enable() {
        if (!await this.isEnabled()) {
            // console.log("wallet:", this.wallet);

            this.walletApi = await this.wallet.enable();
            // console.log("walletApi:", this.walletApi);


            if (this.walletName == CardanoWalletName.YOROI) {
                const auth = this.walletApi.auth || this.walletApi.experimental.auth;

                if (auth) {
                    this.walletAuth = await auth();
                    // console.log("walletAuth:", this.walletAuth)
                } else {
                    // console.warn("auth() is undefined");
                    return;
                }
            }
        }
    }

    async login(walletName: string) {
        this.wallet = undefined;
        this.walletApi = undefined;
        this.walletAuth = undefined;
        this.walletName = undefined;

        // if (!SUPPORTED_WALLETS.includes(walletName)) {
        //     throw WalletErrorMessage.UNSUPPORTED_WALLET(walletName);
        // }

        walletName = walletName.toLowerCase();

        if (walletName === CardanoWalletName.TYPHON) {
            walletName = "typhoncip30";
        }

        let wallet = (window as any).cardano[walletName];
        if (!wallet) {
            throw WalletErrorMessage.NOT_INSTALLED_WALLET(walletName);
        }

        // if (EXPERIMENTAL_WALLETS.includes(walletName)) {
        //     console.warn(`${walletName} may be unstable. Use it carefully.`);
        //     throw WalletErrorMessage.UNSUPPORTED_WALLET(walletName);
        // }

        this.wallet = wallet;
        this.walletName = walletName as CardanoWalletName;
        await this.enable();
    }


    /* ACCOUNT INFO */

    private async _getCborUsedAddresses(): Promise<string[]> {
        if (!await this.isEnabled()) {
            throw WalletErrorMessage.NOT_CONNECTED_WALLET(this.name());
        }
        
        return await this.walletApi.getUsedAddresses({
            page: 0,
            limit: 5,
        });
    }

    async getUsedAddresses() {
        const cborAddresses = await this._getCborUsedAddresses();
        let addresses = cborAddresses.map((addr: string) => 
            Loader.CSL.BaseAddress.from_address(
                Loader.CSL.Address.from_bytes(
                    HexToBuffer(addr)
                )
            )?.to_address().to_bech32()
        );

        addresses = addresses.filter((element: any) => {
            return element !== undefined;
        });
        return addresses;
    }

    private async _getCborBalance() {
        if (!await this.isEnabled()) {
            throw WalletErrorMessage.NOT_CONNECTED_WALLET(this.name());
        }

        return await this.walletApi.getBalance();
    }

    async getBalance(): Promise<CardanoAsset[]> {
        const cborBalance = await this._getCborBalance();
        const value = Loader.CSL.Value.from_bytes(HexToBuffer(cborBalance));
        return CardanoWallet._valueToAssets(value);
    }

    async getBalanceToken(unit: string): Promise<string> {
        const assets: CardanoAsset[] = await this.getBalance();
        const filteredAsset = assets.filter(elem => elem.unit == unit);
        return filteredAsset[0] ? filteredAsset[0].quantity : '0';
    }

    // TODO: replace to util
    private static _valueToAssets(value: any) {
        const assets: CardanoAsset[] = [];
        assets.push({
            unit: 'lovelace',
            quantity: value.coin().to_str()
        });
        if (value.multiasset()) {
            const multiAssets = value.multiasset().keys();
            for (let j = 0; j < multiAssets.len(); j++) {
                const policy = multiAssets.get(j);
                const policyAssets = value.multiasset().get(policy);
                const assetNames = policyAssets.keys();
                for (let k = 0; k < assetNames.len(); k++) {
                    const policyAsset = assetNames.get(k);
                    const quantity = policyAssets.get(policyAsset);
                    const asset =
                        Buffer.from(
                            policy.to_bytes()
                        ).toString('hex') + "." +
                        Buffer.from(
                            policyAsset.name()
                        ).toString('ascii')

                    assets.push({
                        unit: asset,
                        quantity: quantity.to_str(),
                    });
                }
            }
        }
        return assets;
    }

    private async _getCborUtxos(): Promise<string[]> {
        return await this.walletApi.getUtxos();
    }

    async getUtxos() {
        const hexUtxos = await this._getCborUtxos();
        const Utxos = hexUtxos.map(
            utxo => Loader.CSL.TransactionUnspentOutput.from_bytes(HexToBuffer(utxo))
        );
        const UTXOS: {txHash: string, txId: number, amount: any}[] = [];
        for (const utxo of Utxos) {
            let value = utxo.output().amount();
            let assets = CardanoWallet._valueToAssets(value);

            UTXOS.push({
                txHash: HexToBuffer(
                    utxo.input().transaction_id().to_bytes()
                ).toString('hex'),
                txId: utxo.input().index(),
                amount: assets
            });
        }
        return UTXOS;
    }

    
    /* TRANSACTION HANDLING */

    private static _initTxBuilderV9(protocolParameters: any) {
        const txBuilder = Loader.CSL.TransactionBuilder.new(
            // LinearFee (min_fee_a, min_fee_b)
            Loader.CSL.LinearFee.new(
                Loader.CSL.BigNum.from_str(protocolParameters.min_fee_a.toString()),
                Loader.CSL.BigNum.from_str(protocolParameters.min_fee_b.toString())
            ),
            // min_utxo
            Loader.CSL.BigNum.from_str("1000000" /* protocolParameters.min_utxo.toString() */), // TODO: update for protocolParameters value
            // pool_deposit
            Loader.CSL.BigNum.from_str(protocolParameters.pool_deposit.toString()),
            // key_deposit
            Loader.CSL.BigNum.from_str(protocolParameters.key_deposit.toString()),
            // max_value_size
            protocolParameters.max_val_size,
            // max_tx_size
            protocolParameters.max_tx_size,
            protocolParameters.price_mem,
            protocolParameters.price_step,
            Loader.CSL.LanguageViews.new(HexToBuffer(LANGUAGE_VIEWS))
        );
        return txBuilder;
    }

    /*
    private static _initTxBuilderV10(protocolParameters: any) {
        const txBuilder = Loader.CSL.TransactionBuilder.new(
            Loader.CSL.TransactionBuilderConfigBuilder.new()
                .fee_algo(
                    Loader.CSL.LinearFee.new(
                        Loader.CSL.BigNum.from_str(protocolParameters.min_fee_a.toString()),
                        Loader.CSL.BigNum.from_str(protocolParameters.min_fee_b.toString()))
                )
                .pool_deposit(Loader.CSL.BigNum.from_str(protocolParameters.pool_deposit.toString()))
                .key_deposit(Loader.CSL.BigNum.from_str(protocolParameters.key_deposit.toString()))
                .coins_per_utxo_word(Loader.CSL.BigNum.from_str(protocolParameters.coins_per_utxo_word.toString()))
                .max_value_size(protocolParameters.max_val_size)
                .max_tx_size(protocolParameters.max_tx_size)
                .prefer_pure_change(true)
                .build()
        );
        return txBuilder;
    }
    */

    private static _initTxBuilder = (protocolParameters: any) =>
        CardanoWallet._initTxBuilderV9(protocolParameters);
        // CardanoWallet._initTxBuilderV10(protocolParameters);
    
    
    private static _makeMultiAsset(assets: CardanoAsset[]) {
        let AssetsMap: any = {}
        for (let asset of assets) {
            let [policy, assetName] = asset.unit.split('.');
            let quantity = asset.quantity;
            
            if (!Array.isArray(AssetsMap[policy])) {
                AssetsMap[policy] = [];
            }

            AssetsMap[policy].push({
                "unit": AsciiToHex(assetName),
                "quantity": quantity
            });
        }

        let multiAsset = Loader.CSL.MultiAsset.new();
        for (let policy in AssetsMap) {
            let ScriptHash = Loader.CSL.ScriptHash.from_bytes(HexToBuffer(policy));
            let Assets = Loader.CSL.Assets.new();

            let _assets = AssetsMap[policy];

            for (let asset of _assets) {
                let AssetName = Loader.CSL.AssetName.new(Buffer.from(asset.unit, 'hex'));
                let BigNum = Loader.CSL.BigNum.from_str(asset.quantity.toString());
                Assets.insert(AssetName, BigNum);
            }
            multiAsset.insert(ScriptHash, Assets);
        }
        return multiAsset;
    }

    async buildTx(
        payer: any,
        // script = null,
        recipients: {
            address: string,
            amount?: string,
            assets?: CardanoAsset[]
        }[] = [],

        metadata: any = undefined,

        ttl = 3600,
        networkId = 0
    ) {
        // Init transaction builder
        const protocolParameters = await this.blockchainProvider?.getProtocolParameters(networkId);
        // console.log("protocolParameters:", protocolParameters);
        const txBuilder = CardanoWallet._initTxBuilder(protocolParameters);

        // const coinSelection = new CoinSelection();

        CoinSelection.setProtocolParameters(
            protocolParameters.min_utxo.toString(),
            protocolParameters.min_fee_a.toString(),
            protocolParameters.min_fee_b.toString(),
            protocolParameters.max_tx_size.toString()
        );

        const datums = Loader.CSL.PlutusList.new();
        const redeemers = Loader.CSL.Redeemers.new();
        const plutusScripts = Loader.CSL.PlutusScripts.new();

        const transactionWitnessSet = Loader.CSL.TransactionWitnessSet.new();

        // Init outputs
        const outputs = Loader.CSL.TransactionOutputs.new();

        for (let recipient of recipients) {
            let lovelace = recipient.amount ? recipient.amount : "1000000";
            let outputValue = Loader.CSL.Value.new(Loader.CSL.BigNum.from_str(lovelace));

            if ((recipient.assets && recipient.assets.length > 0)) {
                // console.log(recipient.assets);
                let multiAsset = CardanoWallet._makeMultiAsset(recipient.assets);
                outputValue.set_multiasset(multiAsset);
                let minAda = Loader.CSL.min_ada_required(
                    outputValue,
                    Loader.CSL.BigNum.from_str(protocolParameters.coins_per_utxo_word).checked_add(Loader.CSL.BigNum.from_str("1000000"))
                );
                if (Loader.CSL.BigNum.from_str(lovelace).compare(minAda) < 0) {
                    outputValue.set_coin(minAda);
                }
            }

            if (parseInt(outputValue.coin().to_str()) > 0) {
                outputs.add(
                    Loader.CSL.TransactionOutput.new(
                        Loader.CSL.Address.from_bech32(recipient.address),
                        outputValue
                    )
                );
            }
        }


        // TODO: add script handling

        // const cborUtxos = await this._getCborUtxos();
        let payerUtxos = payer.cborUtxos.map((utxos: string) =>
            Loader.CSL.TransactionUnspentOutput.from_bytes(HexToBuffer(utxos))
        );

        const selection = await CoinSelection.randomImprove(
            payerUtxos,
            outputs,
            20
        );
        // console.log(selection);

        for (let i = 0; i < selection.input.length; ++i) {
            txBuilder.add_input(
                Loader.CSL.Address.from_bech32(payer.address),
                selection.input[i].input(),
                selection.input[i].output().amount()
            );
        }

        let auxiliaryData: any = null;
        if (metadata) {
            auxiliaryData = Loader.CSL.AuxiliaryData.new();

            const generalTransactionMetadata = Loader.CSL.GeneralTransactionMetadata.new();
            Object.entries(metadata).map(([label, metadata]) => {
                generalTransactionMetadata.insert(
                    Loader.CSL.BigNum.from_str(label),
                    Loader.CSL.encode_json_str_to_metadatum(JSON.stringify(metadata), 0)
                );
            });
            auxiliaryData.set_metadata(generalTransactionMetadata);

            txBuilder.set_auxiliary_data(auxiliaryData);
        }

        // Adding outputs
        // console.log("adding outputs");
        for (let i = 0; i < outputs.len(); i++) {
            txBuilder.add_output(outputs.get(i));
        }
        
        const now: number = (await this.blockchainProvider?.getLatestBlock(networkId)).slot;
        txBuilder.set_ttl(now + ttl);

        // TODO: add change address
        // console.log("add_change_if_needed");
        txBuilder.add_change_if_needed(
            Loader.CSL.Address.from_bech32(payer.address)
        );
        // txBuilder.set_fee(Loader.CSL.BigNum.from_str("180989"))

        // Init transaction
        const txBody = txBuilder.build();
        const transaction = Loader.CSL.Transaction.new(
            txBody,
            transactionWitnessSet,
            auxiliaryData
        );

        const serializedTx = BufferToHex(Buffer.from(transaction.to_bytes()));

        // TODO: add check for size of tx
        return {
            "rawTx": serializedTx,
            "fee": txBody.fee().to_str(),
            "other": [plutusScripts, datums, redeemers]
        };
    }

    

    async signTx(rawTx: string, partialSign = false): Promise<string> {
        return await this.walletApi.signTx(rawTx, partialSign);
    }

    async submitTx(
        rawTx: string,
        witnesses: string[],
        metadata: any = undefined
    ): Promise<string> {
        const tx = Loader.CSL.Transaction.from_bytes(HexToBuffer(rawTx));

        const txWitnesses = tx.witness_set();
        const txVkeys = txWitnesses.vkeys();
        const txScripts = txWitnesses.native_scripts();
        
        const addWitnesses = Loader.CSL.TransactionWitnessSet.from_bytes(HexToBuffer(witnesses[0]));
        const addVkeys = addWitnesses.vkeys();
        const addScripts = addWitnesses.native_scripts();

        const totalVkeys = Loader.CSL.Vkeywitnesses.new();
        const totalScripts = Loader.CSL.NativeScripts.new();

        if (txVkeys) {
            for (let i = 0; i < txVkeys.len(); i++) {
                totalVkeys.add(txVkeys.get(i));
            }
        }
        if (txScripts) {
            for (let i = 0; i < txScripts.len(); i++) {
                totalScripts.add(txScripts.get(i));
            }
        }
        if (addVkeys) {
            for (let i = 0; i < addVkeys.len(); i++) {
                totalVkeys.add(addVkeys.get(i));
            }
        }
        if (addScripts) {
            for (let i = 0; i < addScripts.len(); i++) {
                totalScripts.add(addScripts.get(i));
            }
        }

        const totalWitnesses = Loader.CSL.TransactionWitnessSet.new();
        totalWitnesses.set_vkeys(totalVkeys);
        totalWitnesses.set_native_scripts(totalScripts);
        let aux; 
        if (metadata){
            aux = Loader.CSL.AuxiliaryData.new()
            const generalMetadata = Loader.CSL.GeneralTransactionMetadata.new();
            const metadatas = Object.entries(metadata);

            for (const m of metadatas) {
                generalMetadata.insert(
                    Loader.CSL.BigNum.from_str(m[0]),
                    Loader.CSL.encode_json_str_to_metadatum(JSON.stringify(m[1]), 0)
                );
            }

            aux.set_metadata(generalMetadata)      
        } else {
            aux = tx.auxiliary_data(); 
        }
        const signedTx = await Loader.CSL.Transaction.new(
            tx.body(),
            totalWitnesses,
            aux
        );

        const txHash = await this.walletApi.submitTx(
            Buffer.from(signedTx.to_bytes(), "hex").toString("hex")
        );

        return txHash;
    }

    async bridge(
        asset: Asset,
        to: {
            address: string,
            chain: ChainName
        },
        by: BridgeName,
        options = {
            isDemo: false,
            ttl: 3600
        }
    ) {
        const networkId = await this.getNetworkId();

        const payer = {
            address: (await this.getUsedAddresses())[0],
            cborUtxos: await this._getCborUtxos(),
        };
        const recipient = {
            address:
                networkId
                ? bridgeConfigs[by][ChainName.Cardano][ChainName.Milkomeda].address
                : bridgeConfigs[by][ChainName.CardanoTestnet][ChainName.MilkomedaDevnet].address,
            amount: asset.token == "lovelace" ? asset.quantity : undefined,
            assets: asset.token != "lovelace" ? [{
                unit: asset.token,
                quantity: asset.quantity
            }] : undefined
            // assets: {
            //     "fda1b6b487bee2e7f64ecf24d24b1224342484c0195ee1b7b943db50.tBLUES": 1000000
            // }
        };
        const metadata =
            networkId
            ? bridgeConfigs[by][ChainName.Cardano][ChainName.Milkomeda].metadata(to.address)
            : bridgeConfigs[by][ChainName.CardanoTestnet][ChainName.MilkomedaDevnet].metadata(to.address);

        const buildedTx = await this.buildTx(payer, [recipient], metadata, options.ttl, networkId);

        const res: BridgeResponse = {
            from: {
                chain: networkId ? ChainName.Cardano : ChainName.CardanoTestnet,
                fee: {
                    token: networkId ? "ADA" : "TADA",
                    quantity: buildedTx.fee as string,
                    decimals: 6
                }
            },
            to: {
                chain: networkId ? ChainName.Milkomeda : ChainName.MilkomedaDevnet,
                fee: {
                    token: networkId ? "milkADA" : "milkTADA",
                    quantity: "100000000000000000",
                    decimals: 18
                }
            },
            by: by
        }

        if (!options.isDemo) {
            const witness = await this.signTx(buildedTx.rawTx);

            const fromTxHash = await this.submitTx(
                buildedTx.rawTx, [witness], metadata
            );
            res.from.tx = {
                hash: fromTxHash,
                wait: async (blockchainProvider = this.blockchainProvider) => {
                    return new Promise<string>(async (resolve, reject) => {
                        if (blockchainProvider) {
                            resolve(await blockchainProvider.getTxBlockHash(fromTxHash, networkId));
                        }
                        reject("BlockchainProvider is undefiend");
                    })
                }
            }
            if (this.bridgeProvider) {
                const bp = this.bridgeProvider;

                res.to.tx = new Promise<Transaction> (async (resolve, reject) => {
                    const toTxHash: string = await bp.getBridgeTxFor(fromTxHash, networkId);
                    resolve ({
                        hash: toTxHash,
                        wait: async (blockchainProvider: any) => {
                            return new Promise<string>(async (resolve, reject) => {
                                if (blockchainProvider) {
                                    resolve((await blockchainProvider.waitForTransaction(toTxHash)).blockHash);
                                }
                                reject("BlockchainProvider is undefiend");
                            })
                        }
                    });
                });
            }
        }

        return res;
    }


    /* EVENT HANDLING */

    async on(eventName: string, callback: any) {
        if (!await this.isEnabled()) {
            throw WalletErrorMessage.NOT_CONNECTED_WALLET(this.name());
        }

        let on = this.walletApi.on || this.walletApi.experimental.on;
        if (!on) {
            switch (eventName) {
            case "accountChange":
                on = this.walletApi.onAccountChange;
                break;
            case "networkChange":
                on = this.walletApi.onNetworkChange;
                break;
            default:
                throw "unknown event";
            }

            if (!on) {
                throw WalletErrorMessage.UNSUPPORTED_METHOD(this.name(), "on(eventName, callback)");
            }

            on(callback);
        } else {
            on(eventName, callback);
        }
    }

    async off(eventName: string, callback: any) {
        if (!await this.isEnabled()) {
            throw WalletErrorMessage.NOT_CONNECTED_WALLET(this.name());
        }

        let off = this.walletApi.off || this.walletApi.experimental.off;
        if (!off) {
            switch (eventName) {
            case "accountChange":
                off = this.walletApi.offAccountChange;
                break;
            case "networkChange":
                off = this.walletApi.offNetworkChange;
                break;
            default:
                throw "unknown event";
            }
    
            if (!off) {
                throw WalletErrorMessage.UNSUPPORTED_METHOD(this.name(), "off(eventName, callback)");
            }

            off(callback);
        } else {
            off(eventName, callback);
        }
    }
}

export { CardanoWallet };
