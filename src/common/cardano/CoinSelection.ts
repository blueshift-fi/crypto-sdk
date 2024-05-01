import {
    TransactionUnspentOutput,
    TransactionOutputs,
    Value, BigNum,
    ScriptHash, AssetName
} from "@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib";
import Loader from "../Loader";
import { AsciiToHex, HexToBuffer } from "../util";


export enum SelectionMode {
    BRUTE_FORCE,
    BIGGER_FIRST,
    // RANDOM,
}


function mergeOutputsAmounts(outputs: TransactionOutputs): Value {
    let compiledAmountList = Loader.CSL.Value.new(
        Loader.CSL.BigNum.from_str("0")
    );

    for (let i = 0; i < outputs.len(); ++i) {
        compiledAmountList = compiledAmountList.checked_add(outputs.get(i).amount());
    }

    return compiledAmountList;
}

function splitAmounts(amounts: Value) {
    const splitAmounts: Value[] = [];
    const mA = amounts.multiasset();
  
    if (mA) {
        const scriptHashes = mA.keys();

        for (let i = 0; i < scriptHashes.len(); ++i) {
            const scriptHash = scriptHashes.get(i);
            const assets = mA.get(scriptHash);

            if (assets) {
                const assetNames = assets.keys();

                for (let j = 0; j < assetNames.len(); ++j) {
                    const assetName = assetNames.get(j);
                    const amount = assets.get(assetName);

                    if (amount) {
                        const _assets = Loader.CSL.Assets.new();
                        _assets.insert(
                            Loader.CSL.AssetName.from_bytes(assetName.to_bytes()),
                            Loader.CSL.BigNum.from_bytes(amount.to_bytes())
                        );
                
                        const _multiasset = Loader.CSL.MultiAsset.new();
                        _multiasset.insert(
                            Loader.CSL.ScriptHash.from_bytes(scriptHash.to_bytes()),
                            _assets
                        );

                        const _value = Loader.CSL.Value.new(
                            Loader.CSL.BigNum.from_str("0")
                        );
                        _value.set_multiasset(_multiasset);
                
                        splitAmounts.push(_value);
                    }
                }
            }
        }
    }

    // TODO: think about it
  
    // Order assets by qty DESC
    // splitAmounts = sortAmountList(splitAmounts, "DESC");
  
    // Insure lovelace is last to account for min ada requirement
    splitAmounts.push(
      Loader.CSL.Value.new(
        Loader.CSL.BigNum.from_bytes(amounts.coin().to_bytes())
      )
    );
  
    return splitAmounts;
}

function compareCoins(leftValue: Value, rightValue: Value) {
    return leftValue.coin().compare(rightValue.coin());
}

function compareMultiAssets(leftValue: Value, rightValue: Value) {
    const lma = leftValue.multiasset();
    const rma = rightValue.multiasset();
  
    if (!lma || !rma) {
        return undefined;
    }

    let res: number | undefined = undefined;
    const scriptHashes = lma.keys();

    for (let i = 0; i < scriptHashes.len(); ++i) {
        const scriptHash = scriptHashes.get(i);
        const leftAssets = lma.get(scriptHash);
        const rightAssets = rma.get(scriptHash);

        if (!leftAssets || !rightAssets) {
            return undefined;
        }

        const lans = leftAssets.keys();

        for (let j = 0; j < lans.len(); ++j) {
            const assetName = lans.get(j);
            const leftAmount = leftAssets.get(assetName);
            const rightAmount = rightAssets.get(assetName);

            if (!leftAmount || !rightAmount) {
                return undefined;
            }

            res = leftAmount.compare(rightAmount);
        }
    }

    return res;
}

function sortByCoin(elems: TransactionUnspentOutput[]) {
    if (elems.length === 0) {
        return [];
    }

    let res = [elems[0]];

    for (let i = 1; i < elems.length; ++i) {
        const amount = elems[i].output().amount().coin();

        let j = 0;
        for (; j < res.length; ++j) {
            const otherAmount = res[j].output().amount().coin();
            if (amount.compare(otherAmount) >= 0) {
                break;
            }
        }

        if (j < res.length) {
            res = [...res.slice(0, j), elems[i], ...res.slice(j)];
        } else {
            res.push(elems[i]);
        }
    }

    return res;
}

function getAmountOfMultiAsset(value: Value, scriptHash: ScriptHash, assetName: AssetName) {
    const multiAsset = value.multiasset();

    if (multiAsset) {
        const assets = multiAsset.get(scriptHash);

        if (assets) {
            return assets.get(assetName);
        }
    }

    return undefined;
}

function sortByMultiAsset(elems: TransactionUnspentOutput[], scriptHash: ScriptHash, assetName: AssetName) {
    if (elems.length === 0) {
        return [];
    }

    let res = [elems[0]];

    for (let i = 1; i < elems.length; ++i) {
        const amount = getAmountOfMultiAsset(elems[i].output().amount(), scriptHash, assetName);

        if (!amount) {
            res.push(elems[i]);
        } else {
            let j = 0;
            for (; j < res.length; ++j) {
                const otherAmount = getAmountOfMultiAsset(res[j].output().amount(), scriptHash, assetName);

                if (!otherAmount || amount.compare(otherAmount) >= 0) {
                    break;
                }
            }

            if (j < res.length) {
                res = [...res.slice(0, j), elems[i], ...res.slice(j)];
            } else {
                res.push(elems[i]);
            }
        }
    }

    return res;
}

export default class CoinSelection {
    private protocolParameters: any;

    setProtocolParameters(minUTxO: string, minFeeA: string, minFeeB: string, maxTxSize: string, coinsPerUtxoByte: string) {
        this.protocolParameters = {
            minUTxO: minUTxO,
            minFeeA: minFeeA,
            minFeeB: minFeeB,
            maxTxSize: maxTxSize,
            coinsPerUtxoByte: coinsPerUtxoByte
        };
        // console.log(this.protocolParameters);
    }

    async findPossibleMax(
        unit: string,
        inputs: TransactionUnspentOutput[],
        limit = 30
    ) {
        if (!this.protocolParameters) {
            throw new Error(
                "Protocol parameters not set. Use setProtocolParameters()."
            );
        }
  
        await Loader.load();

        const selection: TransactionUnspentOutput[] = [];
        let amount: BigNum = Loader.CSL.BigNum.from_str("0");

        if (unit !== "lovelace") {
            const index: number = unit.indexOf('.');
            const scriptHash: ScriptHash = Loader.CSL.ScriptHash.from_bytes(HexToBuffer(unit.slice(0, index)));
            const assetName: AssetName = Loader.CSL.AssetName.new(HexToBuffer(AsciiToHex(unit.slice(index + 1))));

            const sortedInputs = sortByMultiAsset(inputs, scriptHash, assetName);

            for (let input of sortedInputs) {
                const addAmount = getAmountOfMultiAsset(input.output().amount(), scriptHash, assetName);

                if (addAmount === undefined) {
                    break;
                }

                amount = amount.checked_add(addAmount);
                selection.push(input);

                if (selection.length >= limit) {
                    break;
                }
            }
        } else {
            const sortedInputs = sortByCoin(inputs);

            for (let input of sortedInputs) {
                const addAmount = input.output().amount().coin();

                amount = amount.checked_add(addAmount);
                selection.push(input);

                if (selection.length >= limit) {
                    break;
                }
            }
        }

        return {
            amount: amount.to_str(),
            selection: selection
        };
    }

    async select(
        inputs: TransactionUnspentOutput[],
        outputs: TransactionOutputs,
        fee = undefined,
        limit = 30,
        mode = SelectionMode.BIGGER_FIRST
    ) {
        if (!this.protocolParameters) {
            throw new Error(
                "Protocol parameters not set. Use setProtocolParameters()."
            );
        }
  
        await Loader.load();

        const dataCost = Loader.CSL.DataCost.new_coins_per_byte(
            Loader.CSL.BigNum.from_str(this.protocolParameters.coinsPerUtxoByte)
        );

        let utxoSelection = {
            selection: [] as TransactionUnspentOutput[],
            remaining: [...inputs], // Shallow copy
            subset: [] as TransactionUnspentOutput[],
            amount: Loader.CSL.Value.new(Loader.CSL.BigNum.from_str("0")) as Value,
        };

        let mergedOutputsAmounts = mergeOutputsAmounts(outputs);

        let maxFee = Loader.CSL.Value.new(
            fee
            ?   Loader.CSL.BigNum.from_str(fee)
            :   Loader.CSL.BigNum.from_str(this.protocolParameters.minFeeA).checked_mul(
                Loader.CSL.BigNum.from_str(this.protocolParameters.maxTxSize)).checked_add(
                Loader.CSL.BigNum.from_str(this.protocolParameters.minFeeB))
        );

        mergedOutputsAmounts = mergedOutputsAmounts.checked_add(maxFee);

        // Explode amount in an array of unique asset amount for comparison's sake
        let splitedOutputsAmounts = splitAmounts(mergedOutputsAmounts);

        splitedOutputsAmounts.slice(0, -1).forEach((output) => {
            let scriptHash: ScriptHash | undefined;
            let assetName: AssetName | undefined;

            const multiAsset = output.multiasset();
            if (multiAsset) {
                const scriptHashes = multiAsset.keys();
        
                if (scriptHashes.len() === 1) {
                    scriptHash = scriptHashes.get(0);

                    const assets = multiAsset.get(scriptHash);
                    if (assets) {
                        const assetNames = assets.keys();

                        if (assetNames.len() === 1) {
                            assetName = assetNames.get(0);
                        }
                    }
                }
            }
            if (!scriptHash || !assetName) {
                throw new Error("UKNOWN_ASSET");
            }

            let remaining: TransactionUnspentOutput[];
            switch (mode) {
            case SelectionMode.BRUTE_FORCE:
                remaining = [...utxoSelection.remaining];
                break;
            case SelectionMode.BIGGER_FIRST:
            default:
                remaining = sortByMultiAsset(utxoSelection.remaining, scriptHash, assetName);
                break;
            }
            utxoSelection.remaining = [];

            for (let i = 0; i < remaining.length; ++i) {
                const val = remaining[i].output().amount();
                const comparisonMultiAssets = compareMultiAssets(output, utxoSelection.amount);

                if (comparisonMultiAssets === undefined || comparisonMultiAssets > 0) {
                    if (compareMultiAssets(output, val) !== undefined) {
                        utxoSelection.selection.push(remaining[i]);
                        utxoSelection.amount = utxoSelection.amount.checked_add(val);
                    } else {
                        utxoSelection.remaining.push(remaining[i]);
                    }
                } else {
                    utxoSelection.remaining.push(...remaining.slice(i));
                    break;
                }
            }

            const comparisonMultiAssets = compareMultiAssets(output, utxoSelection.amount);
            if (comparisonMultiAssets === undefined || comparisonMultiAssets > 0) {
                throw new Error("BALANCE_EXHAUSTED");
            }
        });

        splitedOutputsAmounts.slice(-1).forEach((output) => {
            let remaining: TransactionUnspentOutput[];
            switch (mode) {
            case SelectionMode.BRUTE_FORCE:
                remaining = [...utxoSelection.remaining.reverse()];
                break;
            case SelectionMode.BIGGER_FIRST:
            default:
                remaining = sortByCoin(utxoSelection.remaining);
                break;
            }
            utxoSelection.remaining = [];

            for (let i = 0; i < remaining.length; ++i) {
                const val = remaining[i].output().amount();
                const comparisonCoins = compareCoins(output, utxoSelection.amount);

                if (comparisonCoins === undefined || comparisonCoins > 0) {
                    if (compareCoins(output, val) !== undefined) {
                        utxoSelection.selection.push(remaining[i]);
                        utxoSelection.amount = utxoSelection.amount.checked_add(val);
                    } else {
                        utxoSelection.remaining.push(remaining[i]);
                    }
                } else {
                    utxoSelection.remaining.push(...remaining.slice(i));
                    break;
                }
            }

            const comparisonCoins = compareCoins(output, utxoSelection.amount);
            if (comparisonCoins === undefined || comparisonCoins > 0) {
                throw new Error("BALANCE_EXHAUSTED");
            } 
        });

        do {
            let txOutputBuilder = Loader.CSL.TransactionOutputBuilder
                .new()
                .with_address(inputs[0].output().address());            

            let txOutputAmountBuilder = txOutputBuilder.next();

            let amountRemaining = utxoSelection.amount.checked_sub(mergedOutputsAmounts);

            let minAda = Loader.CSL.min_ada_for_output(
                txOutputAmountBuilder
                    .with_value(amountRemaining)
                    .build(),
                dataCost
            );

            // console.log(amountRemaining.coin().to_str(), minAda.to_str());

            if (Loader.CSL.BigNum.from_str(amountRemaining.coin().to_str()).compare(minAda) < 0) {
                if (utxoSelection.remaining.length === 0) {
                    throw new Error("BALANCE_EXHAUSTED");
                }
                utxoSelection.selection.push(utxoSelection.remaining[0]);
                utxoSelection.amount = utxoSelection.amount.checked_add(utxoSelection.remaining[0].output().amount());

                utxoSelection.remaining = [...utxoSelection.remaining.slice(1)];
            } else {
                break;
            }
        } while (true);

        if (utxoSelection.selection.length > limit) {
            throw new Error("INPUT_LIMIT_EXCEEDED");
        }

        // TODO: develop it
        // Phase 1: RandomSelect
        // Phase 2: Improve

        // console.log((utxoSelection.amount).coin().to_str());
        // console.log((utxoSelection.amount.checked_sub(mergedOutputsAmounts)).coin().to_str());

        return {
            input: utxoSelection.selection,
            remaining: utxoSelection.remaining,
            reamainingValue: utxoSelection.amount.checked_add(maxFee).checked_sub(mergedOutputsAmounts)
        };
    }
}

function createSubSet(utxoSelection, output: Value) {
    if (Number(output.coin().to_str()) < 1) {
        utxoSelection.remaining.forEach((utxo, index) => {
            if (output.compare(utxo.output().amount()) !== undefined) {
                utxoSelection.subset.push(
                    utxoSelection.remaining.splice(index, 1).pop()
                );
            }
        });
    } else {
        utxoSelection.subset = utxoSelection.remaining.splice(
            0,
            utxoSelection.remaining.length
        );
    }
}
