#!/usr/bin/env node
import { isScheduleActive, activePlaylistItems, activeRunningTextItems, runningTextLine } from "../tv-player/assets/js/presentation-scheduler.js";
let pass=0,fail=0; const ok=(n,c)=>{console.log(`[${c?"PASS":"FAIL"}] ${n}`);c?pass++:fail++;};
const now=new Date("2026-09-18T03:00:00Z");
const config={playlist_items:[
{id:"always",always_show:true,starts_at:"2030-01-01T00:00:00Z",ends_at:"2030-01-02T00:00:00Z"},
{id:"active",always_show:false,starts_at:"2026-09-18T02:00:00Z",ends_at:"2026-09-18T04:00:00Z"},
{id:"expired",always_show:false,starts_at:"2026-09-18T01:00:00Z",ends_at:"2026-09-18T02:00:00Z"}],
running_text:[
{id:"low",text:"Low",enabled:true,priority:1,starts_at:null,ends_at:null,state_scope:["NORMAL"]},
{id:"high",text:"High",enabled:true,priority:20,starts_at:null,ends_at:null,state_scope:["NORMAL","PRE_ADHAN"]},
{id:"off",text:"Off",enabled:false,priority:100,starts_at:null,ends_at:null,state_scope:["NORMAL"]}]};
ok("always_show bypass schedule",isScheduleActive(config.playlist_items[0],now));
const p=activePlaylistItems(config,now);ok("active playlist count = 2",p.length===2);ok("expired filtered",!p.some(x=>x.id==="expired"));
const r=activeRunningTextItems(config,"NORMAL",now);ok("running filter",r.length===2);ok("priority desc",r[0].id==="high");
ok("PRE_ADHAN scope",activeRunningTextItems(config,"PRE_ADHAN",now).length===1);
ok("joined line",runningTextLine(config,"NORMAL",now)==="High • Low");
ok("unknown state empty",activeRunningTextItems(config,"UNKNOWN",now).length===0);
console.log(`\n=== SUMMARY ===\nPASS: ${pass}\nFAIL: ${fail}\nRESULT: ${fail?"FAIL":"CLEAN"}`);process.exit(fail?1:0);
