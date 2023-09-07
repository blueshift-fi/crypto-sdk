import { Address } from "@dcspark/cardano-multiplatform-lib-browser";
import { Buffer } from "buffer";
import { ethers } from "ethers";
import { z, ZodError } from "zod";
import { JSON_RPC_ERROR_CODES, ProviderRpcError } from "../errors";
import { CustomMethod, IMilkomedaProvider, RequestArguments } from "../types";
import { encodePayload, getActorAddress } from "../utils";

const TransactionSchema = z.object({
  from: z.string(),
  to: z.string(),
  gas: z.string(),
  gasPrice: z.string().optional(),
  value: z.string().optional(),
  data: z.string().optional(),
  nonce: z.string().optional(),
});

const InputSchema = z.union([
  z.tuple([TransactionSchema]),
  z.tuple([
    TransactionSchema,
    z.string().refine((salt) => ethers.utils.isHexString(salt, 32), { message: "Invalid salt" }),
  ]),
]);

/**
 * @dev Wraps the eth transaction to the Actor transaction, signs using cardano provider
 * and sends it to the oracle.
 */
const eth_sendTransaction: CustomMethod = async (
  provider: IMilkomedaProvider,
  { params }: RequestArguments
) => {
  const { cardanoProvider, actorFactoryAddress } = provider;

  if (actorFactoryAddress === undefined) {
    throw new ProviderRpcError(
      "Actor factory address not set. Run setup() first.",
      JSON_RPC_ERROR_CODES.DISCONNECTED
    );
  }

  try {
    const [transaction, salt] = InputSchema.parse(params);

    const { from, to, value, data, nonce, gas: gasLimit, gasPrice: gasPriceArg } = transaction;

    const actorNonce =
      nonce ?? (await provider.oracleRequest({ method: "eth_getActorNonce", params: [from] }));

    if (actorNonce === undefined) {
      throw new ProviderRpcError("Invalid nonce", JSON_RPC_ERROR_CODES.INVALID_PARAMS);
    }

    const gasPrice = gasPriceArg ?? (await provider.providerRequest({ method: "eth_gasPrice" }));

    if (gasPrice === undefined) {
      throw new ProviderRpcError("Invalid gas price", JSON_RPC_ERROR_CODES.INVALID_PARAMS);
    }

    const cardanoAddress = "addr1qyfrrvl6h5qnfdfnczt8f0k05l7p7v5zp8axphc92rf52h7rxasurpxajp2jaa68ankz4ka4dgpej0848wlffx0v7s4sqp8asq";
    // const cardanoAddress = await cardanoProvider.getChangeAddress();
    // const bech32Address = Address.from_bytes(Buffer.from(cardanoAddress, "hex")).to_bech32();

    if (
      from.toUpperCase() !== (await getActorAddress(provider, cardanoAddress, salt)).toUpperCase()
    ) {
      throw new ProviderRpcError("Invalid from address", JSON_RPC_ERROR_CODES.INVALID_PARAMS);
    }

    const payload = encodePayload({
      from,
      nonce: actorNonce,
      to,
      value: value ?? 0,
      gasLimit,
      gasPrice,
      calldata: data ?? [],
    });

    const signedTransaction = await cardanoProvider.signData(cardanoAddress, payload.slice(2));

    return await provider.oracleRequest({
      method: "eth_sendAdaActorTransaction",
      params: [signedTransaction, salt].filter(Boolean),
    });
  } catch (e) {
    if (e instanceof ProviderRpcError) {
      throw e;
    }

    if (e instanceof ZodError) {
      throw new ProviderRpcError("Invalid input", JSON_RPC_ERROR_CODES.INVALID_PARAMS, e);
    }

    throw new ProviderRpcError(
      "Failed to send transaction",
      JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      e
    );
  }
};

export default eth_sendTransaction;
