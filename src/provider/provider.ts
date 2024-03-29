import { IMilkomedaProvider, RequestArguments } from "./types";
import methods from "./methods/index";
// import EventEmitter from "events";
import { ProviderRpcError } from "./errors";
import { CardanoWallet } from "../wallet";

class MilkomedaProvider implements IMilkomedaProvider {
  public readonly isMilkomeda = true;
  public readonly cardanoProvider: any;

  public actorFactoryAddress: string | undefined = undefined;

  private nextId = 1;

  constructor(private readonly oracleUrl: string, private readonly jsonRpcProviderUrl: string, cardanoWallet: CardanoWallet) {
    // super();

    // if (window.cardano === undefined) {
    //   throw new Error("Cardano provider not found");
    // }

    this.cardanoProvider = cardanoWallet;
  }

  async setup(): Promise<void> {
    this.actorFactoryAddress = await this.jsonRpcRequest(this.oracleUrl, {
      method: "eth_actorFactoryAddress",
      params: [],
    });

    // this.emit("connect");
  }

  async request(payload: RequestArguments): Promise<unknown> {
    if (payload.method in methods) {
      return methods[payload.method](this, payload);
    }

    return this.providerRequest(payload);
  }

  async oracleRequest<T>(payload: RequestArguments): Promise<T> {
    return this.jsonRpcRequest<T>(this.oracleUrl, payload);
  }

  async providerRequest<T>(payload: RequestArguments): Promise<T> {
    return this.jsonRpcRequest<T>(this.jsonRpcProviderUrl, payload);
  }

  private async jsonRpcRequest<T>(url: string, payload: RequestArguments): Promise<T> {
    const reponse = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.nextId++,
        method: payload.method,
        params: payload.params,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const { result, error } = await reponse.json();

    if (error) {
      throw new ProviderRpcError(error.message, error.code, error.data);
    }

    return result;
  }
}

export default MilkomedaProvider;
