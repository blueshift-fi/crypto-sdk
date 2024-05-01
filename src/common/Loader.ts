

class Loader {
    private csl_wasm: any;

    async load() {
      if (this.csl_wasm) return;
      this.csl_wasm = await import("@emurgo/cardano-serialization-lib-browser/");
      // this.csl_wasm = await import("../../custom_modules/@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib");
    }
  
    get CSL() {
      return this.csl_wasm;
    }
}

export default new Loader();
