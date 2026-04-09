import * as exports from '../vendor/midnight-ledger-v8/midnight_ledger_wasm_bg.js';
import { __wbg_set_wasm } from '../vendor/midnight-ledger-v8/midnight_ledger_wasm_bg.js';
import * as inline0 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline0.js';
import * as inline1 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline1.js';
import * as inline2 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline2.js';
import * as inline3 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline3.js';
import * as inline4 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline4.js';
import * as inline5 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline5.js';
import * as inline6 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline6.js';
import * as inline7 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline7.js';
import * as inline8 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline8.js';
import * as inline9 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline9.js';
import * as inline10 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline10.js';
import * as inline11 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline11.js';
import * as inline12 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline12.js';
import * as inline13 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline13.js';
import * as inline14 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline14.js';
import * as inline15 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline15.js';
import * as inline16 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline16.js';
import * as inline17 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline17.js';
import * as inline18 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline18.js';
import * as inline19 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline19.js';
import * as inline20 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline20.js';
import * as inline21 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline21.js';
import * as inline22 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline22.js';
import * as inline23 from '../vendor/midnight-ledger-v8/snippets/midnight-ledger-wasm-5979ca4215261931/inline23.js';
import wasmUrl from '../vendor/midnight-ledger-v8/midnight_ledger_wasm_bg.wasm';

type LedgerModule = typeof exports;

let ledgerPromise: Promise<LedgerModule> | null = null;

function createImports() {
  return {
    './midnight_ledger_wasm_bg.js': exports,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline0.js': inline0,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline1.js': inline1,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline2.js': inline2,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline3.js': inline3,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline4.js': inline4,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline5.js': inline5,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline6.js': inline6,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline7.js': inline7,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline8.js': inline8,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline9.js': inline9,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline10.js': inline10,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline11.js': inline11,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline12.js': inline12,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline13.js': inline13,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline14.js': inline14,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline15.js': inline15,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline16.js': inline16,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline17.js': inline17,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline18.js': inline18,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline19.js': inline19,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline20.js': inline20,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline21.js': inline21,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline22.js': inline22,
    './snippets/midnight-ledger-wasm-5979ca4215261931/inline23.js': inline23,
  };
}

export async function loadLedger(): Promise<LedgerModule> {
  if (!ledgerPromise) {
    ledgerPromise = (async () => {
      const response = await fetch(wasmUrl);
      const bytes = await response.arrayBuffer();
      const module = await WebAssembly.compile(bytes);
      const instance = await WebAssembly.instantiate(module, createImports() as any);
      const wasm = instance.exports as any;
      __wbg_set_wasm(wasm);
      wasm.__wbindgen_start();
      return exports;
    })();
  }

  return ledgerPromise;
}
