declare module '*.js';
declare module '*.wasm' {
  const url: string;
  export default url;
}
