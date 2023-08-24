import Wallet from "../Wallet";
import { WalletErrorCode, WalletErrors } from "../WalletError";

import Loader from "../../common/Loader";
import CoinSelection, { SelectionMode } from "../../common/cardano/CoinSelection";
import BlockchainProvider from "../../blockchain/interfaces/BlockchainProvider";
import BridgeProvider from "../../bridge/BridgeProvider";
import { BridgeSupport } from "../interfaces/BridgeSupport";

import { Asset, Transaction } from "../../common/types";
import { CardanoAsset } from "./types";

import { Buffer } from "buffer";
import { AsciiToHex, BufferToAscii, BufferToHex, HexToAscii, HexToBuffer } from "../../common/util";
import { BridgeResponse, BridgeName, ChainName, bridgeConfigs } from "../../bridge";

import { CardanoWalletName } from "./config";
import { Blockfrost } from "../../blockchain";


const UTXO_LIMIT = 40;


const SUPPORTED_WALLETS = [
    CardanoWalletName.NAMI,
    CardanoWalletName.FLINT,
    CardanoWalletName.CARDWALLET,
];

const EXPERIMENTAL_WALLETS = [
    CardanoWalletName.ETERNL,
    CardanoWalletName.TYPHON,
    CardanoWalletName.YOROI,
    CardanoWalletName.NUFI,
];

const UNSUPPORTED_WALLETS = [
    CardanoWalletName.GEROWALLET,
];

const LANGUAGE_VIEWS = "a141005901d59f1a000302590001011a00060bc719026d00011a000249f01903e800011a000249f018201a0025cea81971f70419744d186419744d186419744d186419744d186419744d186419744d18641864186419744d18641a000249f018201a000249f018201a000249f018201a000249f01903e800011a000249f018201a000249f01903e800081a000242201a00067e2318760001011a000249f01903e800081a000249f01a0001b79818f7011a000249f0192710011a0002155e19052e011903e81a000249f01903e8011a000249f018201a000249f018201a000249f0182001011a000249f0011a000249f0041a000194af18f8011a000194af18f8011a0002377c190556011a0002bdea1901f1011a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000242201a00067e23187600010119f04c192bd200011a000249f018201a000242201a00067e2318760001011a000242201a00067e2318760001011a0025cea81971f704001a000141bb041a000249f019138800011a000249f018201a000302590001011a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a000249f018201a00330da70101ff";


class CardanoWallet implements Wallet, BridgeSupport {
    public static readonly supportedWallets = SUPPORTED_WALLETS;
    public static readonly experimentalWallets = EXPERIMENTAL_WALLETS;

    private wallet: any;
    private walletApi: any;
    private walletAuth: any;
    private walletName: CardanoWalletName | undefined;

    private blockchainProvider: BlockchainProvider | undefined;
    private protocolParameters: any;
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
            console.warn("Cardano API not found");
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
        if (!await this.isEnabled()) {
            throw WalletErrors[WalletErrorCode.NOT_CONNECTED_WALLET];
        }

        let networkId = -1;

        switch(this.walletName) {
            case CardanoWalletName.YOROI:
                const cborAddresses = await this._getCborUsedAddresses();
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

        if (![...SUPPORTED_WALLETS, ...EXPERIMENTAL_WALLETS].map(elem => elem.toString()).includes(walletName)) {
            throw WalletErrors[WalletErrorCode.UNSUPPORTED_WALLET](walletName)
        }

        walletName = walletName.toLowerCase();

        if (walletName === CardanoWalletName.TYPHON) {
            walletName = "typhoncip30";
        }

        let wallet = (window as any).cardano[walletName];
        if (!wallet) {
            throw WalletErrors[WalletErrorCode.NOT_INSTALLED_WALLET](walletName);
        }

        if (EXPERIMENTAL_WALLETS.map(elem => elem.toString()).includes(walletName)) {
            console.warn(`${walletName} may be unstable. Use it carefully.`);
        }

        this.wallet = wallet;
        this.walletName = walletName as CardanoWalletName;
        await this.enable();
    }


    /* ACCOUNT INFO */

    private async _getCborUsedAddresses(): Promise<string[]> {        
        return await this.walletApi.getUsedAddresses({
            page: 0,
            limit: 5,
        });
    }

    async getUsedAddresses() {
        if (!await this.isEnabled()) {
            throw WalletErrors[WalletErrorCode.NOT_CONNECTED_WALLET];
        }

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

    async getRewardAddress() {
        if (!await this.isEnabled()) {
            throw WalletErrors[WalletErrorCode.NOT_CONNECTED_WALLET];
        }

        console.log(await this.walletApi.getRewardAddresses());

        const cborAddress = (await this.walletApi.getRewardAddresses())[0];
        const address = Loader.CSL.RewardAddress.from_address(
            Loader.CSL.Address.from_bytes(
                HexToBuffer(cborAddress)
            )
        )?.to_address().to_bech32();

        return address;
    }

    async getChangeAddress() {
        if (!await this.isEnabled()) {
            throw WalletErrors[WalletErrorCode.NOT_CONNECTED_WALLET];
        }

        const cborAddress = await this.walletApi.getChangeAddress();
        const address = Loader.CSL.BaseAddress.from_address(
            Loader.CSL.Address.from_bytes(
                HexToBuffer(cborAddress)
            )
        )?.to_address().to_bech32();

        return address;
    }

    async getAddress() {
        return this.getChangeAddress();
    }

    async signData(addr: string, payload: string): Promise<{ key: string; signature: string }> {
        if (!await this.isEnabled()) {
            throw WalletErrors[WalletErrorCode.NOT_CONNECTED_WALLET];
        }

        return this.walletApi.signData(addr, payload);
    }

    private async _getCborBalance() {
        return await this.walletApi.getBalance();
    }

    async getBalance(): Promise<CardanoAsset[]> {
        if (!await this.isEnabled()) {
            throw WalletErrors[WalletErrorCode.NOT_CONNECTED_WALLET];
        }

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

    async _getCborUtxos(): Promise<string[]> {
        switch (this.walletName) {
            case CardanoWalletName.NUFI:
            case CardanoWalletName.FLINT:
                const utxos = await (this.blockchainProvider as Blockfrost).getAddressUtxos(
                    (await this.getUsedAddresses())[0],
                    await this.getNetworkId()
                );
    
                return utxos.map(utxo => this.toCborUtxo(utxo));

            default:
                return await this.walletApi.getUtxos();
        }
    }

    async getUtxos() {
        const hexUtxos = await this._getCborUtxos();

        const Utxos = hexUtxos.map(
            utxo => Loader.CSL.TransactionUnspentOutput.from_bytes(HexToBuffer(utxo))
        );
        const UTXOS: {txHash: string, txId: number, address: string, amount: any}[] = [];
        for (const utxo of Utxos) {
            let value = utxo.output().amount();
            let assets = CardanoWallet._valueToAssets(value);

            UTXOS.push({
                txHash: HexToBuffer(
                    utxo.input().transaction_id().to_bytes()
                ).toString('hex'),
                txId: utxo.input().index(),
                address: utxo.output().address().to_bech32(),
                amount: assets
            });
        }
        return UTXOS;
    }

    toUtxo(hexUtxos: any) {
        const Utxos = hexUtxos.map(
            utxo => Loader.CSL.TransactionUnspentOutput.from_bytes(HexToBuffer(utxo))
        );
        const UTXOS: {txHash: string, txId: number, address: string, amount: any}[] = [];
        for (const utxo of Utxos) {
            let value = utxo.output().amount();
            let assets = CardanoWallet._valueToAssets(value);

            UTXOS.push({
                txHash: HexToBuffer(
                    utxo.input().transaction_id().to_bytes()
                ).toString('hex'),
                txId: utxo.input().index(),
                address: utxo.output().address().to_bech32(),
                amount: assets
            });
        }
        return UTXOS;
    }

    toCborUtxo(utxo: any) {
        let val = Loader.CSL.Value.new(Loader.CSL.BigNum.from_str(utxo.amount[0]["quantity"]));
        let assets = utxo.amount.slice(1);
        if (assets.length > 0) {
            assets = assets.map(asset => {
                let policy = asset.unit.substring(0, 56);
                let name = asset.unit.substring(56);
                name = HexToAscii(name);
                return {
                    unit: `${policy}.${name}`,
                    quantity: asset.quantity
                }
            });
            // console.log("Ku", assets);
            let multiAsset = CardanoWallet._makeMultiAsset(assets);
            val.set_multiasset(multiAsset);
        }
        const input = Loader.CSL.TransactionInput.new(Loader.CSL.TransactionHash.from_bytes(HexToBuffer(utxo.tx_hash)), utxo.tx_index);
        const output = Loader.CSL.TransactionOutput.new(Loader.CSL.Address.from_bech32(utxo.address), val);

        return BufferToHex(Buffer.from(Loader.CSL.TransactionUnspentOutput.new(input, output).to_bytes()));
    }

    
    /* TRANSACTION HANDLING */
    
    // private static _initTxBuilderV9(protocolParameters: any) {
    //     const linearFee = Loader.CSL.LinearFee.new(
    //         Loader.CSL.BigNum.from_str(protocolParameters.min_fee_a.toString()),
    //         Loader.CSL.BigNum.from_str(protocolParameters.min_fee_b.toString())
    //     );

    //     const txBuilder = Loader.CSL.TransactionBuilder.new(
    //         // LinearFee (min_fee_a, min_fee_b)
    //         linearFee,
    //         // min_utxo
    //         Loader.CSL.BigNum.from_str("1000000" /* protocolParameters.min_utxo.toString() */), // TODO: update for protocolParameters value
    //         // pool_deposit
    //         Loader.CSL.BigNum.from_str(protocolParameters.pool_deposit.toString()),
    //         // key_deposit
    //         Loader.CSL.BigNum.from_str(protocolParameters.key_deposit.toString()),
    //         // max_value_size
    //         protocolParameters.max_val_size,
    //         // max_tx_size
    //         protocolParameters.max_tx_size,
    //         protocolParameters.price_mem,
    //         protocolParameters.price_step,
    //         Loader.CSL.LanguageViews.new(HexToBuffer(LANGUAGE_VIEWS))
    //     );
    //     return txBuilder;
    // }

    /*
    private static _initTxBuilderV10(protocolParameters: any) {
        const linearFee = Loader.CSL.LinearFee.new(
            Loader.CSL.BigNum.from_str(protocolParameters.min_fee_a.toString()),
            Loader.CSL.BigNum.from_str(protocolParameters.min_fee_b.toString())
        );

        const txBuilderCfg = Loader.CSL.TransactionBuilderConfigBuilder.new()
            .fee_algo(linearFee)
            .pool_deposit(Loader.CSL.BigNum.from_str(protocolParameters.pool_deposit.toString()))
            .key_deposit(Loader.CSL.BigNum.from_str(protocolParameters.key_deposit.toString()))
            .coins_per_utxo_word(Loader.CSL.BigNum.from_str(protocolParameters.coins_per_utxo_word.toString()))
            .max_value_size(protocolParameters.max_val_size)
            .max_tx_size(protocolParameters.max_tx_size)
            .prefer_pure_change(true)
            .build()

        const txBuilder = Loader.CSL.TransactionBuilder.new(txBuilderCfg);

        return txBuilder;
    }
    */

    private static _initTxBuilderV11(protocolParameters: any) {
        const linearFee = Loader.CSL.LinearFee.new(
            Loader.CSL.BigNum.from_str(protocolParameters.min_fee_a.toString()),
            Loader.CSL.BigNum.from_str(protocolParameters.min_fee_b.toString())
        );

        const txBuilderCfg = Loader.CSL.TransactionBuilderConfigBuilder.new()
            .fee_algo(linearFee)
            .pool_deposit(Loader.CSL.BigNum.from_str(protocolParameters.pool_deposit.toString()))
            .key_deposit(Loader.CSL.BigNum.from_str(protocolParameters.key_deposit.toString()))
            .coins_per_utxo_word(Loader.CSL.BigNum.from_str(protocolParameters.coins_per_utxo_word.toString()))
            .max_value_size(protocolParameters.max_val_size)
            .max_tx_size(protocolParameters.max_tx_size)
            .prefer_pure_change(true)
            .build()

        const txBuilder = Loader.CSL.TransactionBuilder.new(txBuilderCfg);

        return txBuilder;
    }

    private static _initTxBuilder = (protocolParameters: any) =>
        // CardanoWallet._initTxBuilderV9(protocolParameters);
        // CardanoWallet._initTxBuilderV10(protocolParameters);
        CardanoWallet._initTxBuilderV11(protocolParameters);
    
    
    private static _makeMultiAsset(assets: CardanoAsset[]) {
        let AssetsMap: any = {}
        for (let asset of assets) {
            const index = asset.unit.indexOf('.');
            const policy = asset.unit.slice(0, index);
            const assetName = asset.unit.slice(index + 1);
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
        fee: any = undefined,

        metadata: any = undefined,

        ttl = 3600,
        networkId = 0
    ) {
        // Init transaction builder
        if (!this.protocolParameters) {
            this.protocolParameters = await this.blockchainProvider?.getProtocolParameters(networkId);
        }
        // console.log("protocolParameters:", protocolParameters);
        const txBuilder = CardanoWallet._initTxBuilder(this.protocolParameters);

        const coinSelection = new CoinSelection();

        coinSelection.setProtocolParameters(
            this.protocolParameters.min_utxo.toString(),
            this.protocolParameters.min_fee_a.toString(),
            this.protocolParameters.min_fee_b.toString(),
            this.protocolParameters.max_tx_size.toString(),
            this.protocolParameters.coins_per_utxo_word.toString()
        );

        const dataCost = Loader.CSL.DataCost.new_coins_per_byte(
            Loader.CSL.BigNum.from_str(
                this.protocolParameters.coins_per_utxo_word.toString()
            )
        );

        const datums = Loader.CSL.PlutusList.new();
        const redeemers = Loader.CSL.Redeemers.new();
        const plutusScripts = Loader.CSL.PlutusScripts.new();

        const transactionWitnessSet = Loader.CSL.TransactionWitnessSet.new();

        // Init outputs
        const outputs = Loader.CSL.TransactionOutputs.new();

        // console.log(recipients);

        for (let recipient of recipients) {
            let txOutputBuilder = Loader.CSL.TransactionOutputBuilder
                .new()
                .with_address(Loader.CSL.Address.from_bech32(recipient.address));

            let txOutputAmountBuilder = txOutputBuilder.next();


            // build value

            const lovelace = recipient.amount ? recipient.amount : "1000000";
            const outputValue = Loader.CSL.Value.new(Loader.CSL.BigNum.from_str(lovelace));

            if ((recipient.assets && recipient.assets.length > 0)) {
                const multiAsset = CardanoWallet._makeMultiAsset(recipient.assets);
                outputValue.set_multiasset(multiAsset);

                const minAda = Loader.CSL.min_ada_for_output(
                    txOutputAmountBuilder
                        .with_value(outputValue)
                        .build(),
                    dataCost
                );
                if (Loader.CSL.BigNum.from_str(lovelace).compare(minAda) < 0) {
                    outputValue.set_coin(minAda);
                }
            }

            // add output
            if (parseInt(outputValue.coin().to_str()) > 0) {
                outputs.add(
                    txOutputAmountBuilder
                        .with_value(outputValue)
                        .build()
                );
            }
        }


        // TODO: add script handling

        // const cborUtxos = await this._getCborUtxos();
        let payerUtxos = payer.cborUtxos.map((utxos: string) =>
            Loader.CSL.TransactionUnspentOutput.from_bytes(HexToBuffer(utxos))
        );

        let selection;
        try {
            let newFee = fee;

            while (true) {
                selection = await coinSelection.select(
                    payerUtxos,
                    outputs,
                    newFee,
                    UTXO_LIMIT,
                    SelectionMode.BIGGER_FIRST
                );

                let reamainingLovelace = selection.reamainingValue.coin();

                const alwaysNeedLovelace = Loader.CSL.BigNum.from_str("1000000").checked_add(Loader.CSL.BigNum.from_str(fee ? fee : "300000"));
                let needLovelace = alwaysNeedLovelace;

                if (selection.reamainingValue.multiasset() !== undefined) {
                    let txOutputBuilder = Loader.CSL.TransactionOutputBuilder
                        .new()
                        .with_address(Loader.CSL.Address.from_bech32(payer.address));

                    let txOutputAmountBuilder = txOutputBuilder.next();


                    // build value
                    const lovelace = Loader.CSL.BigNum.from_str("1000000");
                    const outputValue = selection.reamainingValue;
                    outputValue.set_coin(lovelace);

                    const minAda = Loader.CSL.min_ada_for_output(
                        txOutputAmountBuilder
                            .with_value(outputValue)
                            .build(),
                        dataCost
                    );

                    if (lovelace.compare(minAda) < 0) {
                        outputValue.set_coin(minAda);
                    }

                    // add output

                    // if (parseInt(outputValue.coin().to_str()) > 0) {
                        outputs.add(
                            txOutputAmountBuilder
                                .with_value(outputValue)
                                .build()
                        );
                    // }


                    needLovelace = needLovelace.checked_add(outputValue.coin());
                    reamainingLovelace = reamainingLovelace.checked_sub(outputValue.coin());
                }

                if (reamainingLovelace.compare(alwaysNeedLovelace) < 0) {
                    newFee = needLovelace.to_str();
                    continue;
                }

                break;
            }
        } catch (err) {
            switch(err.message) {
            case "BALANCE_EXHAUSTED":
            case "INPUT_LIMIT_EXCEEDED":
                throw WalletErrors[WalletErrorCode.TRANSACTION_BUILDING_FAILED](err.message);

            default:
                throw WalletErrors[WalletErrorCode.UNKNOWN](err.message);
            }
        }
        // console.log("selection:", selection);

        for (let i = 0; i < selection.input.length; ++i) {
            txBuilder.add_input(
                selection.input[i].output().address(),
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
        let signedTx: string;
        try {
            signedTx = await this.walletApi.signTx(rawTx, partialSign);
        } catch (err) {
            console.warn(err);
            throw WalletErrors[WalletErrorCode.API_CALL_FAILED](err?.message || err?.info);
        }
        return signedTx;
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

        let txHash: string;
        try {
            txHash = await this.walletApi.submitTx(
                Buffer.from(signedTx.to_bytes(), "hex").toString("hex")
            );
        } catch (err) {
            console.warn(err);
            throw WalletErrors[WalletErrorCode.API_CALL_FAILED](err?.message || err?.info);
        }
        return txHash;
    }

    async estimateMaxBridgeAmount(token: string) {
        const networkId = await this.getNetworkId();

        if (!this.protocolParameters) {
            this.protocolParameters = await this.blockchainProvider?.getProtocolParameters(networkId);
        }
        // console.log("protocolParameters:", this.protocolParameters);

        const coinSelection = new CoinSelection();

        coinSelection.setProtocolParameters(
            this.protocolParameters.min_utxo.toString(),
            this.protocolParameters.min_fee_a.toString(),
            this.protocolParameters.min_fee_b.toString(),
            this.protocolParameters.max_tx_size.toString(),
            this.protocolParameters.coins_per_utxo_word.toString()
        );

        const utxos = await this._getCborUtxos();
        
        return coinSelection.findPossibleMax(
            token,
            utxos.map((utxo: string) => Loader.CSL.TransactionUnspentOutput.from_bytes(HexToBuffer(utxo))),
            UTXO_LIMIT
        );
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

        this.protocolParameters = await this.blockchainProvider?.getProtocolParameters(networkId);

        const usedAddress = (await this.getUsedAddresses())[0];
        const balance = (await this.getBalance()).filter(b => b.unit === asset.token)[0];

        const payer = {
            address: usedAddress,
            cborUtxos: await this._getCborUtxos(),
        };
        const recipients = [{
            address:
                networkId
                ? bridgeConfigs[by][ChainName.Cardano][ChainName.Milkomeda].address
                : bridgeConfigs[by][ChainName.CardanoTestnet][ChainName.MilkomedaDevnet].address,
            amount: asset.token == "lovelace" && !Loader.CSL.BigNum.from_str(asset.quantity).is_zero() ? asset.quantity : undefined,
            assets: asset.token != "lovelace" && !Loader.CSL.BigNum.from_str(asset.quantity).is_zero() ? [{
                unit: asset.token,
                quantity: asset.quantity
            }] : undefined
        }];
        const metadata =
            networkId
            ? bridgeConfigs[by][ChainName.Cardano][ChainName.Milkomeda].metadata(to.address)
            : bridgeConfigs[by][ChainName.CardanoTestnet][ChainName.MilkomedaDevnet].metadata(to.address);
        
        let buildedTx = await this.buildTx(payer, recipients, "300000", metadata, options.ttl, networkId);

        const res: BridgeResponse = {
            from: {
                chain: networkId ? ChainName.Cardano : ChainName.CardanoTestnet,
                fee: {
                    token: "lovelace",
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
                wait: async (blockchainProvider = this.blockchainProvider, confirmations = 0) => {
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
                        wait: async (blockchainProvider: any, confirmations = 0) => {
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

    async bridgeExtra(
        assets: {
            gas: string,
            token?: Asset,
        } | {
            gas?: string,
            token: Asset,
        },
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

        this.protocolParameters = await this.blockchainProvider?.getProtocolParameters(networkId);

        const usedAddress = (await this.getUsedAddresses())[0];

        // const balance = (await this.getBalance()).filter(b => b.unit === asset.token)[0];

        const payer = {
            address: usedAddress,
            cborUtxos: await this._getCborUtxos(),
        };
        const recipients = [{
            address:
                networkId
                ? bridgeConfigs[by][ChainName.Cardano][ChainName.Milkomeda].address
                : bridgeConfigs[by][ChainName.CardanoTestnet][ChainName.MilkomedaDevnet].address,
            amount: assets.gas && !Loader.CSL.BigNum.from_str(assets.gas).is_zero() ? assets.gas : undefined,
            assets: assets.token && !Loader.CSL.BigNum.from_str(assets.token.quantity).is_zero() ? [{
                unit: assets.token.token,
                quantity: assets.token.quantity
            } as CardanoAsset] : undefined
        }];
        const metadata =
            networkId
            ? bridgeConfigs[by][ChainName.Cardano][ChainName.Milkomeda].metadata(to.address)
            : bridgeConfigs[by][ChainName.CardanoTestnet][ChainName.MilkomedaDevnet].metadata(to.address);
        
        let buildedTx = await this.buildTx(payer, recipients, "300000", metadata, options.ttl, networkId);

        const res: BridgeResponse = {
            from: {
                chain: networkId ? ChainName.Cardano : ChainName.CardanoTestnet,
                fee: {
                    token: "lovelace",
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
                wait: async (blockchainProvider = this.blockchainProvider, confirmations = 0) => {
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
                        wait: async (blockchainProvider: any, confirmations = 0) => {
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
            throw WalletErrors[WalletErrorCode.NOT_CONNECTED_WALLET];
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
                throw WalletErrors[WalletErrorCode.UNSUPPORTED_METHOD](this.name(), "on(eventName, callback)");
            }

            on(callback);
        } else {
            on(eventName, callback);
        }
    }

    async off(eventName: string, callback: any) {
        if (!await this.isEnabled()) {
            throw WalletErrors[WalletErrorCode.NOT_CONNECTED_WALLET];
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
                throw WalletErrors[WalletErrorCode.UNSUPPORTED_METHOD](this.name(), "off(eventName, callback)");
            }

            off(callback);
        } else {
            off(eventName, callback);
        }
    }
}

export { CardanoWallet };
