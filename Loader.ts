class Loader {
    private _wasm: any;

    async load() {
      if (this._wasm) return;
      // this._wasm = await import("@emurgo/cardano-serialization-lib-browser/");
      this._wasm = await import("./custom_modules/@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib");
    }
  
    get CSL() {
      return this._wasm;
    }
}

export default new Loader();
