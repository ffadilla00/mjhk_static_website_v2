#!/usr/bin/env node

import { RevisionAckOutbox } from "../tv-player/assets/js/revision-ack-outbox.js";
import { RevisionAckDelivery, classifyAckError } from "../tv-player/assets/js/revision-ack-delivery.js";

const REV = "53b55497-f01e-4809-a7be-828a8bf0c9a9";
const OLD = "43b55497-f01e-4809-a7be-828a8bf0c9a8";
let pass = 0;
let fail = 0;

function ok(name, condition) {
  console.log(`[${condition ? "PASS" : "FAIL"}] ${name}`);
  condition ? pass++ : fail++;
}

class MemoryStorage {
  constructor(){ this.map = new Map(); }
  getItem(key){ return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value){ this.map.set(key, String(value)); }
  removeItem(key){ this.map.delete(key); }
}

function sessionStore(){
  return { load(){ return { deviceCode:"SIM-01", deviceToken:"x".repeat(64) }; } };
}

{
  const outbox = new RevisionAckOutbox(new MemoryStorage());
  outbox.enqueue({ revision_id: REV, success:false, error_message:"Bearer supersecret sb_secret_abcdef" });
  const item = outbox.list()[0];
  ok("negative ACK stored", item.success === false);
  ok("ACK error is redacted", !item.error_message.includes("sb_secret_") && !item.error_message.includes("supersecret"));
}

{
  const outbox = new RevisionAckOutbox(new MemoryStorage());
  const gateway = { async request(path, init){
    if (path !== "/v1/device/revision/ack") throw new Error("wrong path");
    if (init.body.revision_id !== REV || init.body.success !== true) throw new Error("wrong body");
    return {status:200,data:{ok:true}};
  }};
  const delivery = new RevisionAckDelivery({gatewayClient:gateway,sessionStore:sessionStore(),outbox});
  const result = await delivery.submit({revision_id:REV,success:true,error_message:null});
  ok("success ACK sent", result.status === "sent");
  ok("sent ACK removed from outbox", outbox.list().length === 0);
}

{
  const outbox = new RevisionAckOutbox(new MemoryStorage());
  const gateway = { async request(){ const e = new Error("stale"); e.status=409; e.payload={error:"stale_revision_ack"}; throw e; } };
  const delivery = new RevisionAckDelivery({gatewayClient:gateway,sessionStore:sessionStore(),outbox});
  const result = await delivery.submit({revision_id:OLD,success:true,error_message:null});
  ok("stale ACK treated terminal", result.status === "stale");
  ok("stale ACK removed", outbox.list().length === 0);
}

{
  const outbox = new RevisionAckOutbox(new MemoryStorage());
  const gateway = { async request(){ const e = new Error("down"); e.status=503; e.payload={error:"upstream_unavailable"}; throw e; } };
  const delivery = new RevisionAckDelivery({gatewayClient:gateway,sessionStore:sessionStore(),outbox});
  const result = await delivery.submit({revision_id:REV,success:true,error_message:null});
  ok("transient ACK is queued", result.status === "queued");
  ok("transient ACK remains in outbox", outbox.list().length === 1);
  ok("transient ACK increments attempts", outbox.list()[0].attempts === 1);
}

{
  const outbox = new RevisionAckOutbox(new MemoryStorage());
  const gateway = { async request(){ return {status:200,data:{ok:true}}; } };
  const delivery = new RevisionAckDelivery({gatewayClient:gateway,sessionStore:sessionStore(),outbox});
  const result = await delivery.recoverSuccessAck({bootstrap:{desired_revision_id:REV,applied_revision_id:null},localRevisionId:REV});
  ok("missing server ACK recovered", result.status === "sent" && result.recovery === true);
}

{
  const outbox = new RevisionAckOutbox(new MemoryStorage());
  let calls=0;
  const gateway = { async request(){ calls++; return {status:200,data:{ok:true}}; } };
  const delivery = new RevisionAckDelivery({gatewayClient:gateway,sessionStore:sessionStore(),outbox});
  const result = await delivery.recoverSuccessAck({bootstrap:{desired_revision_id:REV,applied_revision_id:REV},localRevisionId:REV});
  ok("server-already-applied needs no ACK", result.status === "not_needed");
  ok("no duplicate ACK sent", calls === 0);
}

ok("409 classified stale", classifyAckError({status:409,payload:{error:"stale_revision_ack"}}) === "stale");
ok("503 classified transient", classifyAckError({status:503}) === "transient");
ok("401 classified permanent", classifyAckError({status:401}) === "permanent");

console.log(`\n=== SUMMARY ===\nPASS: ${pass}\nFAIL: ${fail}\nRESULT: ${fail ? "FAIL" : "CLEAN"}`);
process.exit(fail ? 1 : 0);
