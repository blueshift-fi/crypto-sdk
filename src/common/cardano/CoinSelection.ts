import {
    TransactionUnspentOutput,
    TransactionOutputs,
    Value,
} from "@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib";
import Loader from "../Loader";


/**
 * Compile all required outputs to a flat amounts list
 * @param outputs - The set of outputs requested for payment.
 * @return The compiled set of amounts requested for payment.
 */
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

export default class CoinSelection {
    private protocolParameters: any;

    setProtocolParameters(minUTxO: string, minFeeA: string, minFeeB: string, maxTxSize: string, coinsPerUtxoWord: string) {
        this.protocolParameters = {
            minUTxO: minUTxO,
            minFeeA: minFeeA,
            minFeeB: minFeeB,
            maxTxSize: maxTxSize,
            coinsPerUtxoWord: coinsPerUtxoWord
        };
        console.log(this.protocolParameters);
    }

    async select(
        inputs: TransactionUnspentOutput[],
        outputs: TransactionOutputs,
        limit = 20
    ) {
        if (!this.protocolParameters) {
            throw new Error(
                "Protocol parameters not set. Use setProtocolParameters()."
            );
        }
  
        await Loader.load();

        let utxoSelection = {
            selection: [] as TransactionUnspentOutput[],
            remaining: [...inputs], // Shallow copy
            subset: [] as TransactionUnspentOutput[],
            amount: Loader.CSL.Value.new(Loader.CSL.BigNum.from_str("0")) as Value,
        };

        let mergedOutputsAmounts = mergeOutputsAmounts(outputs);

        let maxFee = Loader.CSL.Value.new(
            Loader.CSL.BigNum.from_str(this.protocolParameters.minFeeA).checked_mul(
            Loader.CSL.BigNum.from_str(this.protocolParameters.maxTxSize)).checked_add(
            Loader.CSL.BigNum.from_str(this.protocolParameters.minFeeB))
        );

        mergedOutputsAmounts = mergedOutputsAmounts.checked_add(maxFee);

        // Explode amount in an array of unique asset amount for comparison's sake
        let splitedOutputsAmounts = splitAmounts(mergedOutputsAmounts);

        splitedOutputsAmounts.slice(0, -1).forEach((output) => {
            const remaining = [...utxoSelection.remaining];
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
                throw new Error("INPUTS_EXHAUSTED");
            }
        });

        splitedOutputsAmounts.slice(-1).forEach((output) => {
            const remaining = [...utxoSelection.remaining.reverse()];
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
                throw new Error("INPUTS_EXHAUSTED");
            } 
        });

        do {
            const amountRemaining = utxoSelection.amount.checked_sub(mergedOutputsAmounts);

            const minAda = Loader.CSL.min_ada_required(
                amountRemaining,
                Loader.CSL.BigNum.from_str(this.protocolParameters.coinsPerUtxoWord).checked_add(Loader.CSL.BigNum.from_str("1000000"))
            );

            if (Loader.CSL.BigNum.from_str(amountRemaining.coin().to_str()).compare(minAda) < 0) {
                if (utxoSelection.remaining.length === 0) {
                    throw new Error("INPUTS_EXHAUSTED");
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

        return {
            input: utxoSelection.selection,
            remaining: utxoSelection.remaining
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
