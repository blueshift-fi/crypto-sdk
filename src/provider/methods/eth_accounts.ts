import { Address } from "@dcspark/cardano-multiplatform-lib-browser";
import { Buffer } from "buffer";
import { ethers } from "ethers";
import { z, ZodError } from "zod";
import { JSON_RPC_ERROR_CODES, ProviderRpcError } from "../errors";
import { CustomMethod, IMilkomedaProvider, RequestArguments } from "../types";
import { getActorAddress } from "../utils";

const InputSchema = z.union([
  z.tuple([]),
  z.tuple([
    z.string().refine((salt) => ethers.utils.isHexString(salt, 32), { message: "Invalid salt" }),
  ]),
]);

/**
 * @dev Requests cardano address from injected cardano provider and transforms it to the Actor address
 */
const eth_accounts: CustomMethod = async (
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
    if (!(await cardanoProvider.isEnabled())) {
      return [];
    }

    const [salt] = InputSchema.parse(params);

    // After the page refresh the object needs to be enabled again
    // await cardanoProvider.enable();

    const address = await cardanoProvider.getChangeAddress();

    // const bech32Address = Address.from_bytes(Buffer.from(address, "hex")).to_bech32();

    return [await getActorAddress(provider, address, salt)];
  } catch (e) {
    if (e instanceof ZodError) {
      throw new ProviderRpcError("Invalid input", JSON_RPC_ERROR_CODES.INVALID_PARAMS, e);
    }

    throw new ProviderRpcError("Failed to get accounts", JSON_RPC_ERROR_CODES.INTERNAL_ERROR, e);
  }
};

export default eth_accounts;
