import { ethers } from "ethers";
import { IMilkomedaProvider } from "./types";

export const getActorAddress = async (
  provider: IMilkomedaProvider,
  mainchainAddress: string,
  salt?: ethers.BytesLike
) => {
  const functionSignature = ethers.utils
    .keccak256(ethers.utils.toUtf8Bytes("getActorAddress(string,bytes32)"))
    .slice(0, 10);

  const callData = ethers.utils.hexConcat([
    functionSignature,
    ethers.utils.defaultAbiCoder.encode(
      ["string", "bytes32"],
      [mainchainAddress, salt ?? ethers.constants.HashZero]
    ),
  ]);

  const result = await provider.providerRequest<string>({
    method: "eth_call",
    params: [{ to: provider.actorFactoryAddress, data: callData }, "latest"],
  });

  return ethers.utils.defaultAbiCoder.decode(["address"], result)[0];
};

export interface ActorTransaction {
  from: string;
  nonce: ethers.BigNumberish;
  to: string;
  value: ethers.BigNumberish;
  gasLimit: ethers.BigNumberish;
  gasPrice: ethers.BigNumberish;
  calldata: ethers.BytesLike;
}

export const encodePayload = ({
  from,
  nonce,
  to,
  value,
  gasLimit,
  gasPrice,
  calldata,
}: ActorTransaction) => {
  return ethers.utils.defaultAbiCoder.encode(
    ["address", "uint256", "address", "uint256", "uint256", "uint256", "bytes"],
    [from, nonce, to, value, gasLimit, gasPrice, calldata]
  );
};
