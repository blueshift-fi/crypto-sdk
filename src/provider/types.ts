import { CardanoWallet } from "../wallet";

export interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[];
}

// export interface CardanoProvider {
//   getNetworkId(): Promise<number>;
//   getUtxos(): Promise<string[] | undefined>;
//   getBalance(): Promise<string>;
//   getUsedAddresses(): Promise<string[]>;
//   getUnusedAddresses(): Promise<string[]>;
//   getChangeAddress(): Promise<string>;
//   getRewardAddresses(): Promise<string[]>;
//   getCollateral(): Promise<string[]>;
//   signTx(tx: string, partialSign: boolean): Promise<string>;
//   submitTx(tx: string): Promise<string>;
//   isEnabled(): Promise<boolean>;
//   enable(): Promise<CardanoProvider>;
//   signData(addr: string, payload: string): Promise<{ key: string; signature: string }>;
// }

export interface EthereumProvider {
  request(payload: RequestArguments): Promise<unknown>;
}

export interface IMilkomedaProvider extends EthereumProvider {
  isMilkomeda: boolean;
  // cardanoProvider: CardanoProvider;
  cardanoProvider: CardanoWallet;
  actorFactoryAddress: string | undefined;
  setup(): Promise<void>;
  oracleRequest<T>(payload: RequestArguments): Promise<T>;
  providerRequest<T>(payload: RequestArguments): Promise<T>;
}

export type CustomMethod = (
  provider: IMilkomedaProvider,
  payload: RequestArguments
) => Promise<unknown>;
