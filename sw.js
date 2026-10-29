// 서비스 워커: 푸시 알림을 띄우고, 안드로이드 알림의 "했어요 / 내일로" 버튼을 처리해요.
importScripts("config.js");
const CFG = self.APP_CONFIG || {};
const PRAISE = ["잘했어요!", "최고!", "역시 너밖에 없어", "오늘도 해냈다!", "집이 반짝반짝해졌어요", "말랑이가 감동했어요", "이 집의 자랑!", "해낼 줄 알았어!"];
const SHELL = ["./", "index.html", "styles.css", "app.js", "store.js", "shared/plan.js", "config.js", "manifest.webmanifest", "mom.html", "dad.html", "manifest-mom.webmanifest", "manifest-dad.webmanifest", "icons/icon-192.png"];
const CACHE = "nd-v4";

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
// 앱 화면 파일은 인터넷이 되면 새로 받고, 안 되면 저장해 둔 걸 써요
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (x) { d = { title: "내리두리 집안일", body: e.data ? e.data.text() : "" }; }
  const opts = {
    body: d.body, tag: d.tag, renotify: true, icon: "icons/icon-192.png", badge: "icons/badge-96.png",
    data: { url: d.url || "./#today", tasks: d.tasks || [], person: d.person, kind: d.kind, log: d.log, from: d.from },
  };
  if (d.tasks && d.tasks.length) opts.actions = [{ action: "done", title: "했어요 ⭐" }, { action: "later", title: "내일로 미루기" }];
  if (d.kind === "did") opts.actions = [{ action: "st:crown", title: "👑 최고!" }, { action: "st:heart", title: "💖 사랑해" }];
  e.waitUntil(self.registration.showNotification(d.title || "내리두리 집안일", opts));
});

const rest = (path, init) => fetch(`${CFG.supabaseUrl}/rest/v1/${path}`, {
  ...init, headers: { apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${CFG.supabaseAnonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
});
const callServer = body => fetch(`${CFG.supabaseUrl}/functions/v1/tick`, {
  method: "POST", headers: { apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${CFG.supabaseAnonKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
}).catch(() => {});
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

self.addEventListener("notificationclick", e => {
  const n = e.notification; n.close();
  const { tasks = [], person, url, kind, log, from } = n.data || {};
  const work = async () => {
    if (kind === "did" && e.action && e.action.startsWith("st:")) {
      const id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await rest("stickers", { method: "POST", body: JSON.stringify({ id, log_id: log, from_p: person, to_p: from, kind: e.action.slice(3) }) });
      await callServer({ sticker: id });
      return self.registration.showNotification("칭찬 스티커를 보냈어요 💌", { body: "말랑이가 전해줄게요!", tag: "cheer", icon: "icons/icon-192.png" });
    }
    if (e.action === "done" && tasks.length) {
      for (const t of tasks) {
        const at = Date.now();
        const lid = "l" + at.toString(36) + Math.random().toString(36).slice(2, 6);
        if (t.id) await rest(`tasks?id=eq.${encodeURIComponent(t.id)}`, { method: "PATCH", body: JSON.stringify({ status: "done", done_by: person, done_at: new Date().toISOString() }) });
        await rest("logs", { method: "POST", body: JSON.stringify({ id: lid, chore_id: t.chore_id, by: person, date: ymd(new Date()), at, task_id: t.id || null }) });
        await callServer({ did: lid });
      }
      return self.registration.showNotification(PRAISE[Math.floor(Math.random() * PRAISE.length)], { body: `별 +${tasks.length} 모았어요`, tag: "cheer", icon: "icons/icon-192.png" });
    }
    if (e.action === "later" && tasks.length) {
      const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
      for (const t of tasks) if (t.id) await rest(`tasks?id=eq.${encodeURIComponent(t.id)}`, { method: "PATCH", body: JSON.stringify({ day: ymd(tmr), postpone_count: (t.pc || 0) + 1 }) });
      return self.registration.showNotification("내일로 옮겼어요", { body: "내일 다시 알려줄게요. 푹 쉬어요!", tag: "cheer", icon: "icons/icon-192.png" });
    }
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  };
  e.waitUntil(work());
});
