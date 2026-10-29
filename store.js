// 저장소: Supabase가 설정돼 있으면 두 사람이 함께 쓰는 서버에, 아니면 이 기기에만 저장해요.
import { DEFAULT_CHORES, DEFAULT_PREFS, K, add, mondayOf } from "./shared/plan.js";

const seed = () => ({ id: 1, chores: DEFAULT_CHORES, prefs: DEFAULT_PREFS });

export async function createStore(cfg) {
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) return supabaseStore(cfg);
  return localStore();
}

function supabaseStore(cfg) {
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const must = ({ data, error }) => { if (error) throw error; return data; };
  return {
    kind: "server",
    async load() {
      const since = K(add(mondayOf(new Date()), -14));
      const recent = new Date(Date.now() - 14 * 864e5).toISOString();
      const [hh, tasks, logs, weeks, requests, stickers] = await Promise.all([
        sb.from("household").select("*").eq("id", 1).maybeSingle().then(must),
        sb.from("tasks").select("*").or(`status.eq.todo,day.gte.${since}`).then(must),
        sb.from("logs").select("*").then(must),
        sb.from("weeks").select("*").then(must),
        sb.from("requests").select("*").or(`status.eq.open,created_at.gte.${recent}`).then(must),
        sb.from("stickers").select("*").then(must),
      ]);
      let household = hh;
      if (!household) { household = seed(); await sb.from("household").upsert(household).then(must); }
      return { household, tasks, logs, weeks, requests, stickers };
    },
    upsertTasks: rows => sb.from("tasks").upsert(rows, { onConflict: "id", ignoreDuplicates: true }).then(must),
    updateTask: (id, patch) => sb.from("tasks").update(patch).eq("id", id).then(must),
    putTask: row => sb.from("tasks").upsert(row).then(must),
    delWeekTodo: wk => sb.from("tasks").delete().eq("week", wk).eq("status", "todo").then(must),
    addLog: row => sb.from("logs").insert(row).then(must),
    delLog: id => sb.from("logs").delete().eq("id", id).then(must),
    saveHousehold: h => sb.from("household").upsert({ ...h, id: 1, updated_at: new Date().toISOString() }).then(must),
    setWeek: row => sb.from("weeks").upsert(row).then(must),
    publicKey: () => sb.from("public_config").select("value").eq("key", "vapid_public").maybeSingle().then(must).then(r => r && r.value),
    saveSub: row => sb.from("push_subs").upsert(row).then(must),
    delSub: endpoint => sb.from("push_subs").delete().eq("endpoint", endpoint).then(must),
    addRequest: row => sb.from("requests").insert(row).then(must),
    updateRequest: (id, patch) => sb.from("requests").update(patch).eq("id", id).then(must),
    addSticker: row => sb.from("stickers").insert(row).then(must),
    // 알림 서버에 바로 보내 달라고 부탁해요 (테스트 알림, 부탁 알림, 부탁 답장)
    notify: body => fetch(`${cfg.supabaseUrl}/functions/v1/tick`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error("notify " + r.status); }),
    subscribe(onChange) {
      let t = null;
      const ping = () => { clearTimeout(t); t = setTimeout(onChange, 250); };
      const ch = sb.channel("house");
      for (const table of ["household", "tasks", "logs", "weeks", "requests", "stickers"]) ch.on("postgres_changes", { event: "*", schema: "public", table }, ping);
      ch.subscribe();
      document.addEventListener("visibilitychange", () => { if (!document.hidden) ping(); });
    },
  };
}

function localStore() {
  const KEY = "nd-local-v1";
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { db = null; }
  if (!db) db = { household: seed(), tasks: {}, logs: {}, weeks: {} };
  db.requests = db.requests || {};
  db.stickers = db.stickers || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const ok = v => Promise.resolve(v);
  return {
    kind: "local",
    load: () => ok({ household: db.household, tasks: Object.values(db.tasks), logs: Object.values(db.logs), weeks: Object.values(db.weeks), requests: Object.values(db.requests), stickers: Object.values(db.stickers) }),
    upsertTasks: rows => { rows.forEach(r => { if (!db.tasks[r.id]) db.tasks[r.id] = r; }); save(); return ok(); },
    updateTask: (id, patch) => { if (db.tasks[id]) Object.assign(db.tasks[id], patch); save(); return ok(); },
    putTask: row => { db.tasks[row.id] = row; save(); return ok(); },
    delWeekTodo: wk => { for (const [id, t] of Object.entries(db.tasks)) if (t.week === wk && t.status === "todo") delete db.tasks[id]; save(); return ok(); },
    addLog: row => { db.logs[row.id] = row; save(); return ok(); },
    delLog: id => { delete db.logs[id]; save(); return ok(); },
    saveHousehold: h => { db.household = h; save(); return ok(); },
    setWeek: row => { db.weeks[row.monday] = row; save(); return ok(); },
    publicKey: () => ok(null),
    addRequest: row => { db.requests[row.id] = row; save(); return ok(); },
    updateRequest: (id, patch) => { if (db.requests[id]) Object.assign(db.requests[id], patch); save(); return ok(); },
    addSticker: row => { db.stickers[row.id] = row; save(); return ok(); },
    saveSub: () => ok(), delSub: () => ok(), notify: () => Promise.reject(new Error("local")),
    subscribe() {},
  };
}
