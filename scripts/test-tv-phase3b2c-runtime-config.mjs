#!/usr/bin/env node

import {
  prepareRuntimeConfig,
  validateSnapshot,
  RuntimeConfigError,
} from "../tv-player/assets/js/runtime-config-core.js";
import { RuntimeConfigRegistry } from "../tv-player/assets/js/runtime-config.js";

let pass = 0;
let fail = 0;

function ok(name, condition) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    pass += 1;
  } else {
    console.log(`[FAIL] ${name}`);
    fail += 1;
  }
}

const id1 = "53b55497-f01e-4809-a7be-828a8bf0c9a9";
const id2 = "63b55497-f01e-4809-a7be-828a8bf0c9a9";

const lkg1 = {
  kind: "lkg",
  revision_id: id1,
  revision_number: 4,
  snapshot: {
    identity: { name: "MJHK" },
    theme: { header: "#123456" },
  },
};

const lkg2 = {
  kind: "lkg",
  revision_id: id2,
  revision_number: 5,
  snapshot: {
    identity: { name: "MJHK v2" },
  },
};

const prepared = prepareRuntimeConfig(lkg1);
ok("prepareRuntimeConfig menghasilkan frozen runtime", Object.isFrozen(prepared));
ok("nested config ikut frozen", Object.isFrozen(prepared.config.identity));
ok("revision metadata dipertahankan", prepared.revision_number === 4);

const registry = new RuntimeConfigRegistry({ eventTarget: null });
registry.applyFromLkg(lkg1);
const first = registry.current();

registry.applyFromLkg(lkg2);
const second = registry.current();

ok("atomic swap mengganti runtime", first !== second && second.revision_number === 5);

const rolledBack = registry.rollback();
ok("rollback mengembalikan revision sebelumnya", rolledBack.revision_number === 4);

const beforeFailure = registry.current();

let rejected = false;
try {
  const dangerous = Object.create(null);
  dangerous["__proto__"] = { polluted: true };
  validateSnapshot({ nested: dangerous });
} catch (error) {
  rejected = error instanceof RuntimeConfigError &&
    error.code === "snapshot_dangerous_key";
}

ok("dangerous key ditolak", rejected);
ok("failed validation tidak mengubah runtime", registry.current() === beforeFailure);

console.log();
console.log("=== SUMMARY ===");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);

if (fail === 0) {
  console.log("RESULT: CLEAN");
  process.exit(0);
}

console.log("RESULT: FAIL");
process.exit(1);
