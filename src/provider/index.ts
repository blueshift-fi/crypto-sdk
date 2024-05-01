import MilkomedaProvider from "./provider";
import type { IMilkomedaProvider } from "./types";
import {CardanoWallet} from "../wallet";

declare global {
  interface Window {
    ethereum: IMilkomedaProvider | undefined;
  }
}

export const inject = (
  oracleUrl: string,
  jsonRpcProviderUrl: string,
  cardanoWallet: CardanoWallet
): IMilkomedaProvider | undefined => {
  window.ethereum = new MilkomedaProvider(oracleUrl, jsonRpcProviderUrl, cardanoWallet);
  return window.ethereum;
};

export { IMilkomedaProvider, MilkomedaProvider };