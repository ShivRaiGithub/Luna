declare module '@scure/base' {
  export const bech32m: {
    encode(prefix: string, words: number[], limit?: boolean | number): string;
    toWords(bytes: Uint8Array): number[];
  };
}

declare module '*.js';
declare module '*.wasm' {
  const url: string;
  export default url;
}
