// 5분마다 불려서 정해진 시각에 푸시 알림을 보내요 (Asia/Seoul 기준).
// - 할 일 알림: 그날 할 일이 있으면
// - 체크 알림: 오늘까지 할 일이 남아 있으면 "했나요?" (했어요/내일로 버튼)
// - 금요일 할 일 알림 시각: 이번 주 남은 일이 있으면 "이번 주가 2일 남았어요"
// - 일요일 계획 알림 시각: 다음 주 요일 정하기
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  DEFAULT_CHORES, DEFAULT_PREFS, PEOPLE, K, add, mondayOf, generateWeek, isMine, nudgeText,
  askTitle, replyMessage, replyTitle, didTitle, sticker, callName, other, MOM,
} from "../_shared/plan.js";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const WINDOW_MIN = 60; // 정해진 시각부터 이 시간 안에만 보내요 (늦게 켜져도 한참 지난 알림은 안 보냄)

type Payload = { title: string; body: string; tag: string; url?: string; person?: string; kind?: string; log?: string; from?: string; tasks?: { id: string | null; chore_id: string; pc?: number }[] };

async function kv(table: string, key: string) {
  const { data } = await sb.from(table).select("value").eq("key", key).maybeSingle();
  return data?.value as string | undefined;
}

async function vapid() {
  let pub = await kv("public_config", "vapid_public");
  let priv = await kv("app_secrets", "vapid_private");
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey; priv = keys.privateKey;
    await sb.from("app_secrets").upsert({ key: "vapid_private", value: priv });
    await sb.from("public_config").upsert({ key: "vapid_public", value: pub });
  }
  webpush.setVapidDetails("mailto:naeri-duri@example.com", pub, priv);
}

async function sendTo(filter: { person?: string; endpoint?: string }, payload: Payload) {
  let q = sb.from("push_subs").select("*");
  if (filter.person) q = q.eq("person", filter.person);
  if (filter.endpoint) q = q.eq("endpoint", filter.endpoint);
  const { data: subs } = await q;
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...payload, person: s.person }), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("endpoint", s.endpoint);
      else console.error("push failed", code, e);
    }
  }
  return sent;
}

// 같은 알림을 두 번 보내지 않도록 기록 (이미 있으면 false)
async function once(key: string) {
  const { error } = await sb.from("push_log").insert({ key });
  return !error;
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const inWindow = (nowMin: number, at: string) => nowMin >= toMin(at) && nowMin < toMin(at) + WINDOW_MIN;

Deno.serve(async req => {
  const body = await req.json().catch(() => ({}));
  await vapid();

  // 앱의 "테스트 알림 보내기"
  if (body.test) {
    const n = await sendTo({ endpoint: body.test }, { title: "말랑이 테스트 알림", body: "알림이 잘 와요! 이제 할 일이 있을 때 알려줄게요.", tag: "test", url: "./#my" });
    return Response.json({ sent: n });
  }
  // 서로에게 부탁하기: 부탁이 오면 받는 사람에게, 답하면 부탁한 사람에게
  if (body.request || body.reqReply) {
    const id = String(body.request || body.reqReply);
    const { data: r } = await sb.from("requests").select("*").eq("id", id).maybeSingle();
    if (!r) return Response.json({ sent: 0 }, { status: 404 });
    if (body.request) {
      if (!(await once(`req:${id}:ask`))) return Response.json({ sent: 0, dup: true });
      const n = await sendTo({ person: r.to_p }, { title: askTitle(r.from_p), body: r.msg, tag: `req-${id}`, url: "./#today" });
      return Response.json({ sent: n });
    }
    if (r.status === "open" || !(await once(`req:${id}:${r.status}`))) return Response.json({ sent: 0 });
    const ok = r.status === "done";
    const n = await sendTo({ person: r.from_p }, { title: replyTitle(r.to_p, ok), body: replyMessage(r.to_p, r.title, ok), tag: `req-${id}`, url: "./#today" });
    return Response.json({ sent: n });
  }

  // 했어요 → 상대에게 알림 (안드로이드는 알림에서 바로 스티커 보내기)
  if (body.did) {
    const id = String(body.did);
    const { data: l } = await sb.from("logs").select("*").eq("id", id).maybeSingle();
    if (!l || !(await once(`did:${id}`))) return Response.json({ sent: 0 });
    const { data: hh } = await sb.from("household").select("chores").eq("id", 1).maybeSingle();
    const c = ((hh?.chores ?? DEFAULT_CHORES) as typeof DEFAULT_CHORES).find(x => x.id === l.chore_id);
    const payload: Payload = {
      title: didTitle(l.by, l.title ?? c?.name ?? l.chore_id), body: "칭찬 스티커를 보내 주세요 ✨", tag: `did-${id}`, url: "./#today",
      kind: "did", log: id, from: l.by,
    };
    // 같이 사는 상대와 엄마에게
    const n = (await sendTo({ person: other(l.by) }, payload)) + (await sendTo({ person: MOM }, payload));
    return Response.json({ sent: n });
  }
  // 칭찬 스티커 → 일 한 사람에게
  if (body.sticker) {
    const id = String(body.sticker);
    const { data: st } = await sb.from("stickers").select("*").eq("id", id).maybeSingle();
    if (!st || !(await once(`st:${id}`))) return Response.json({ sent: 0 });
    const s = sticker(st.kind);
    const n = await sendTo({ person: st.to_p }, { title: `${callName(st.from_p)}가 칭찬 스티커를 보냈어요!`, body: `${s.e} ${s.t}`, tag: `st-${id}`, url: "./#today" });
    return Response.json({ sent: n });
  }

  // 엄마 메시지 → 받는 딸에게, 하트 → 엄마에게
  if (body.momMsg || body.heart) {
    const id = String(body.momMsg || body.heart);
    const { data: m } = await sb.from("messages").select("*").eq("id", id).maybeSingle();
    if (!m || !(await once(`msg:${id}:${body.momMsg ? "send" : "heart"}`))) return Response.json({ sent: 0 });
    const n = body.momMsg
      ? await sendTo({ person: m.to_p }, { title: "엄마가 메시지를 보냈어요 💌", body: m.msg, tag: `msg-${id}`, url: "./#today" })
      : await sendTo({ person: m.from_p }, { title: `${m.to_p}가 엄마 메시지에 하트를 보냈어요 💖`, body: m.msg.slice(0, 60), tag: `heart-${id}`, url: "./#today" });
    return Response.json({ sent: n });
  }

  const secret = await kv("app_secrets", "cron");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("forbidden", { status: 403 });

  // 서울 시각
  const s = new Date(Date.now() + 9 * 3600e3);
  const today = new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const nowMin = s.getUTCHours() * 60 + s.getUTCMinutes();
  const dow = today.getDay();
  const todayK = K(today);

  const { data: hh } = await sb.from("household").select("*").eq("id", 1).maybeSingle();
  const chores = (hh?.chores ?? DEFAULT_CHORES) as typeof DEFAULT_CHORES;
  const prefs = { ...DEFAULT_PREFS, ...(hh?.prefs ?? {}) } as Record<string, any>;
  const chore = (id: string) => chores.find(c => c.id === id) ?? { id, name: id, mins: 10 };

  // 이번 주(와 일요일엔 다음 주) 계획이 없으면 기본 요일로 만들어요
  const weeks = [mondayOf(today)];
  if (dow === 0) weeks.push(add(mondayOf(today), 7));
  for (const m of weeks) {
    const wk = K(m);
    const { data: w } = await sb.from("weeks").select("monday").eq("monday", wk).maybeSingle();
    if (!w) {
      await sb.from("tasks").upsert(generateWeek(chores, m, todayK), { onConflict: "id", ignoreDuplicates: true });
      await sb.from("weeks").upsert({ monday: wk, planned: false });
    }
  }

  const { data: todo } = await sb.from("tasks").select("*").eq("status", "todo").lte("day", K(add(mondayOf(today), 6)));
  const { data: todayLogs } = await sb.from("logs").select("chore_id").eq("date", todayK);
  const daily = chores.find(c => c.freq === "daily");
  const out: string[] = [];

  for (const p of PEOPLE) {
    const pp = { alarm: "20:00", check: "23:30", ...(prefs[p] ?? {}) };
    const mine = (todo ?? []).filter(t => isMine(t.who, p));

    if (inWindow(nowMin, pp.alarm)) {
      const todays = mine.filter(t => t.day === todayK);
      if (todays.length && await once(`${todayK}:${p}:alarm`)) {
        const names = todays.map(t => chore(t.chore_id).name);
        const mins = todays.reduce((a, t) => a + chore(t.chore_id).mins, 0);
        await sendTo({ person: p }, { title: `오늘은 ${names[0]}${names.length > 1 ? ` 외 ${names.length - 1}개` : ""} 하는 날!`, body: `다 해도 ${mins}분이면 끝나요. 말랑이가 응원할게요`, tag: "alarm", url: "./#today" });
        out.push(`${p}:alarm`);
      }
      // 금요일: 이번 주 남은 일
      if (dow === 5 && mine.length && await once(`${todayK}:${p}:week`)) {
        const mins = mine.reduce((a, t) => a + chore(t.chore_id).mins, 0);
        await sendTo({ person: p }, { title: "이번 주가 2일 남았어요!", body: `남은 일 ${mine.length}개, 다 해도 ${mins}분이에요. 요일을 바꾸고 싶으면 계획에서 옮겨요`, tag: "week", url: "./#plan" });
        out.push(`${p}:week`);
      }
    }

    if (inWindow(nowMin, pp.check)) {
      const due = mine.filter(t => t.day <= todayK);
      const dishDue = daily && isMine(daily.who, p) && !(todayLogs ?? []).some(l => l.chore_id === daily.id);
      if ((due.length || dishDue) && await once(`${todayK}:${p}:check`)) {
        const items = due.map(t => ({ id: t.id, chore_id: t.chore_id, pc: t.postpone_count || 0 }));
        if (dishDue) items.push({ id: null, chore_id: daily!.id, pc: 0 });
        const first = chore(items[0].chore_id);
        const title = items.length === 1 ? `오늘 ${first.name} 했나요?` : `오늘 할 일 ${items.length}개, 했나요?`;
        const most = due.sort((a, b) => (b.postpone_count || 0) - (a.postpone_count || 0))[0];
        const body = most && most.postpone_count >= 1 ? nudgeText(chore(most.chore_id), most.postpone_count)
          : items.length === 1 ? "했으면 별 받고, 시간이 없었으면 내일로 미뤄요" : items.map(i => chore(i.chore_id).name).join(", ");
        await sendTo({ person: p }, { title, body, tag: "check", url: "./#today", tasks: items });
        out.push(`${p}:check`);
      }
    }

    if (dow === 0 && inWindow(nowMin, prefs.plan || "21:00")) {
      const { data: w } = await sb.from("weeks").select("planned").eq("monday", K(add(mondayOf(today), 7))).maybeSingle();
      if (!w?.planned && await once(`${todayK}:${p}:plan`)) {
        await sendTo({ person: p }, { title: "다음 주 할 일, 무슨 요일에 할까요?", body: "바쁜 날은 피해서 골라요. 안 고르면 기본 요일로 알려줄게요", tag: "plan", url: "./#plan" });
        out.push(`${p}:plan`);
      }
    }
  }
  return Response.json({ at: `${todayK} ${Math.floor(nowMin / 60)}:${nowMin % 60}`, sent: out });
});
