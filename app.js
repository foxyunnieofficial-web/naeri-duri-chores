import {
  PEOPLE, DAYN, WEEK_ORDER, RULES, PRAISE, DEFAULT_PREFS, D, K, add, diff, mondayOf, fmtDay, other,
  generateWeek, isMine, freqLabel, nudgeText,
  NICK, WHEN, askMessage, askCount, STICKERS, sticker, callName,
  isParent, genMessage, COLORS, ACCS, DEFAULT_LOOK,
} from "./shared/plan.js";
import { createStore } from "./store.js";

const cfg = self.APP_CONFIG || {};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---- 상태 ----
let store;
let S = { household: null, tasks: {}, logs: [], weeks: {}, requests: {}, stickers: [], messages: {} };
// 엄마용(mom.html)·아빠용(dad.html) 페이지는 그 사람으로 고정돼요
const PARENT = isParent(self.APP_MODE) ? self.APP_MODE : null;
let me = PARENT || "내리";
if (!PARENT) try { const saved = localStorage.getItem("me"); if (PEOPLE.includes(saved)) me = saved; } catch (e) {}
let planWeek = null; // 0 = 이번 주, 1 = 다음 주
let undo = null, toastTimer = null;

const chores = () => S.household.chores;
const chore = id => chores().find(c => c.id === id) || { id, name: id, mins: 10, who: "같이" };
const prefs = () => ({ ...DEFAULT_PREFS, ...(S.household.prefs || {}) });
const now = () => new Date();
const thisMonday = () => mondayOf(now());
const starsOf = p => S.logs.filter(l => l.by === p).length;
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const logName = l => l.title || chore(l.chore_id).name;
const MAIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/><path d="M12 17.5c-1.6-1.2-2.6-2-2.6-3a1.3 1.3 0 0 1 2.6-.3 1.3 1.3 0 0 1 2.6.3c0 1-1 1.8-2.6 3z" fill="currentColor" stroke="none"/></svg>`;

// ---- 말랑이 ----
let uid = 0;
const lookOf = who => ({ ...(DEFAULT_LOOK[who] || DEFAULT_LOOK["같이"]), ...((S.household && S.household.prefs && S.household.prefs[who] && S.household.prefs[who].look) || {}) });
const ACC_SVG = {
  none: "",
  ribbon: `<path d="M50 14 l-11 -8 q-3 7 0 13 z M50 14 l11 -8 q3 7 0 13 z" fill="#ff7f9a"/><circle cx="50" cy="14" r="3.4" fill="#ff6688"/>`,
  sprout: `<path d="M50 14 q-2 -9 -10 -11 q8 -2 10 9 q2 -11 12 -9 q-8 2 -12 11" fill="#7cc98f" stroke="#4f9d63" stroke-width="1.5"/>`,
  crown: `<path d="M35 19 l3 -15 l8 9 l4 -11 l4 11 l8 -9 l3 15 z" fill="#ffc93c" stroke="#e0a400" stroke-width="1.5" stroke-linejoin="round"/><circle cx="50" cy="13" r="2" fill="#ff6688"/>`,
  beret: `<ellipse cx="46" cy="17" rx="23" ry="8" fill="#e05a6d"/><circle cx="46" cy="9" r="3" fill="#e05a6d"/>`,
  glasses: `<g fill="none" stroke="#3b3350" stroke-width="2.6"><circle cx="37" cy="55" r="10"/><circle cx="63" cy="55" r="10"/><path d="M47 55 h6"/></g>`,
  flower: `<g transform="translate(70 22)"><circle cx="0" cy="-6" r="5" fill="#ff8fb1"/><circle cx="6" cy="-2" r="5" fill="#ff8fb1"/><circle cx="4" cy="5" r="5" fill="#ff8fb1"/><circle cx="-4" cy="5" r="5" fill="#ff8fb1"/><circle cx="-6" cy="-2" r="5" fill="#ff8fb1"/><circle r="4" fill="#ffd45c"/></g>`,
  headphones: `<path d="M12 60 C12 18 88 18 88 60" fill="none" stroke="#3b3350" stroke-width="5" stroke-linecap="round"/><rect x="4" y="50" width="13" height="22" rx="6" fill="#8b7cf6"/><rect x="83" y="50" width="13" height="22" rx="6" fill="#8b7cf6"/>`,
  star: `<path d="M70 15 l3 6 6.5 1 -4.8 4.5 1.2 6.5 -5.9 -3.1 -5.9 3.1 1.2 -6.5 -4.8 -4.5 6.5 -1z" fill="#ffc93c" stroke="#e0a400" stroke-width="1.2" stroke-linejoin="round"/>`,
};
export function mallang(who, mood = "happy", size = 100, cls = "squish", look = null) {
  const id = "g" + (++uid);
  const lk = look || lookOf(who);
  const col = (COLORS[lk.color] || COLORS.peach).c;
  const eyes = mood === "happy"
    ? `<path d="M31 55 q6 -7 12 0 M57 55 q6 -7 12 0" stroke="#3b3350" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
    : mood === "worried"
    ? `<circle cx="37" cy="56" r="4.4" fill="#3b3350"/><circle cx="63" cy="56" r="4.4" fill="#3b3350"/><path d="M30 45 l11 4 M70 45 l-11 4" stroke="#3b3350" stroke-width="3" stroke-linecap="round"/>`
    : `<circle cx="37" cy="55" r="4.6" fill="#3b3350"/><circle cx="63" cy="55" r="4.6" fill="#3b3350"/><circle cx="38.6" cy="53.4" r="1.5" fill="#fff"/><circle cx="64.6" cy="53.4" r="1.5" fill="#fff"/>`;
  const mouth = mood === "worried" ? `<path d="M44 70 q6 -5 12 0" stroke="#3b3350" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<path d="M44 66 q6 7 12 0" stroke="#3b3350" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `<svg class="mallang" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${esc(who)}의 말랑이">
    <defs><radialGradient id="${id}" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="${col[0]}"/><stop offset="1" stop-color="${col[1]}"/></radialGradient></defs>
    <ellipse cx="50" cy="94" rx="32" ry="4" fill="#3b3350" opacity=".12"/>
    <g class="${cls}">
      <path d="M50 14 C78 14 93 36 93 62 C93 84 74 93 50 93 C26 93 7 84 7 62 C7 36 22 14 50 14Z" fill="url(#${id})"/>
      <ellipse cx="36" cy="30" rx="10" ry="6" fill="#fff" opacity=".45" transform="rotate(-20 36 30)"/>
      <ellipse cx="26" cy="66" rx="7" ry="4.4" fill="#ff8fa3" opacity=".55"/><ellipse cx="74" cy="66" rx="7" ry="4.4" fill="#ff8fa3" opacity=".55"/>
      ${eyes}${mouth}${ACC_SVG[lk.acc] || ""}
    </g></svg>`;
}
const STAR = (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#ffc93c" stroke="#e0a400" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

// ---- 주간 계획 만들기 ----
async function ensureWeek(monday) {
  const wk = K(monday);
  if (S.weeks[wk]) return;
  const rows = generateWeek(chores(), monday, K(now()));
  S.weeks[wk] = { monday: wk, planned: false };
  rows.forEach(r => { if (!S.tasks[r.id]) S.tasks[r.id] = r; });
  await store.upsertTasks(rows);
  await store.setWeek({ monday: wk, planned: false });
}

// ---- 화면: 오늘 ----
function whoChip(who) { return `<span class="chip c-${esc(who)}">${esc(who)}</span>`; }

function dueTasks() {
  const today = K(now());
  return Object.values(S.tasks).filter(t => t.status === "todo" && t.day <= today && isMine(t.who, me)).sort((a, b) => a.day.localeCompare(b.day));
}
// 매일 하는 일 중 오늘 아직 안 한 것 (그릇 정리, 환기)
function dailyPending() {
  return chores().filter(c => c.freq === "daily" && isMine(c.who, me) && !S.logs.some(l => l.chore_id === c.id && l.date === K(now())));
}

function checkCard(t) {
  const c = chore(t.chore_id);
  const day = D(t.day), today = now();
  const when = diff(today, day) === 0 ? `<span class="st today">오늘</span>` : `<span class="st soon">${fmtDay(day)}에 하기로 한 일</span>`;
  const nudge = nudgeText(c, t.postpone_count || 0);
  return `<div class="card due"><div class="top"><div class="main"><span class="name">${esc(c.name)}</span>
    <span class="meta">${whoChip(t.who)}${when}<span class="mins">약 ${c.mins}분</span>${c.note ? `<span>${esc(c.note)}</span>` : ""}</span></div></div>
    ${nudge ? `<p class="nudge">${esc(nudge)}</p>` : ""}
    <div class="acts"><button type="button" class="btn" data-done="${esc(t.id)}">${STAR(18)} 했어요</button><button type="button" class="btn ghost" data-later="${esc(t.id)}">내일로 미루기</button></div></div>`;
}
function simpleCard(c, extra, btn) {
  return `<div class="card"><div class="top"><div class="main"><span class="name">${esc(c.name)}</span>
    <span class="meta">${extra}<span class="mins">약 ${c.mins}분</span></span></div>${btn}</div></div>`;
}

// ---- 부탁하기 ----
const STATUS = { open: "기다리는 중", done: "해줬어요 💖", declined: "지금은 어렵대요", canceled: "취소했어요" };
function renderRequests() {
  const all = Object.values(S.requests).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const inbox = all.filter(r => r.to_p === me && r.status === "open");
  $("inboxSec").hidden = !inbox.length;
  $("inboxTitle").textContent = `부탁 받은 일 ${inbox.length}개`;
  $("inbox").innerHTML = inbox.map(r => `<div class="card req"><div class="reqfrom">${mallang(r.from_p, "happy", 40, "")}<span>${esc(callName(r.from_p))}의 부탁</span><span class="sub">${esc(WHEN[r.due] || "")}</span></div>
    <p class="reqmsg">${esc(r.msg)}</p>
    <div class="acts"><button type="button" class="btn" data-reqdone="${esc(r.id)}">${STAR(18)} 해줬어요</button><button type="button" class="btn ghost" data-reqno="${esc(r.id)}">지금은 어려워</button></div></div>`).join("");
  const since = Date.now() - 3 * 864e5;
  const sent = all.filter(r => r.from_p === me && (r.status === "open" || new Date(r.created_at).getTime() > since)).slice(0, 5);
  $("sentSec").hidden = !sent.length;
  $("sent").innerHTML = sent.map(r => `<li><span>${esc(r.title)}</span><span class="st ${r.status === "done" ? "ok" : r.status === "open" ? "soon" : "today"}">${STATUS[r.status] || r.status}</span>
    <span class="when">${esc(WHEN[r.due] || "")}</span>${r.status === "open" ? `<button type="button" class="btn ghost small" data-reqcancel="${esc(r.id)}">취소</button>` : ""}</li>`).join("");
}

let ask = { task: null, when: "today", i: 0 };
function askTitleText() { return ask.task ? ask.task.title : $("askText").value.trim(); }
function renderAsk() {
  const to = other(me);
  $("askHead").textContent = `${NICK[to]}에게 부탁하기`;
  const mine = Object.values(S.tasks).filter(t => t.status === "todo" && t.who === me && t.day <= K(add(thisMonday(), 6))).sort((a, b) => a.day.localeCompare(b.day)).slice(0, 8);
  $("askTasks").innerHTML = mine.map(t => `<button type="button" data-asktask="${esc(t.id)}" aria-pressed="${ask.task && ask.task.task_id === t.id}">${esc(chore(t.chore_id).name)} · ${fmtDay(D(t.day))}</button>`).join("")
    || `<span class="sub">내 할 일이 없으면 아래에 직접 써요.</span>`;
  document.querySelectorAll("#askWhen button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.when === ask.when)));
  const title = askTitleText();
  $("askPreview").textContent = title ? askMessage(me, title, ask.when, ask.i) : "부탁할 일을 고르거나 써 주세요. 여기에 보낼 말이 미리 보여요.";
  $("askSend").disabled = !title;
}
function openAsk() { ask = { task: null, when: "today", i: Math.floor(Math.random() * askCount(me)) }; $("askText").value = ""; renderAsk(); $("askSheet").hidden = false; }
async function sendAsk() {
  const title = askTitleText(); if (!title) return;
  const r = { id: newId("r"), from_p: me, to_p: other(me), title, chore_id: ask.task ? ask.task.chore_id : null, task_id: ask.task ? ask.task.task_id : null,
    due: ask.when, msg: askMessage(me, title, ask.when, ask.i), status: "open", created_at: new Date().toISOString() };
  S.requests[r.id] = r; $("askSheet").hidden = true; render();
  try { await store.addRequest(r); toast(`${NICK[r.to_p]}에게 부탁을 보냈어요 💌`, false); store.notify({ request: r.id }).catch(() => {}); }
  catch (e) { fail(e); }
}
async function answerRequest(id, ok) {
  const r = S.requests[id]; if (!r) return;
  const patch = { status: ok ? "done" : "declined", done_at: new Date().toISOString() };
  Object.assign(r, patch);
  let log = null;
  if (ok) {
    log = { id: newId("l"), chore_id: r.chore_id || "request", title: r.chore_id ? null : r.title, by: me, date: K(now()), at: Date.now(), task_id: r.task_id || null };
    S.logs.push(log);
    const t = r.task_id && S.tasks[r.task_id];
    if (t && t.status === "todo") Object.assign(t, { status: "done", done_by: me, done_at: patch.done_at });
    const n = starsOf(me);
    $("cheerMallang").innerHTML = mallang(me, "happy", 120, "hop");
    $("cheerMsg").textContent = `${callName(r.from_p)}가 엄청 좋아할 거예요!`;
    $("cheerPlus").textContent = `${r.title} 완료 · 별 +1 (모두 ${n}개)`;
    $("cheerUndo").hidden = true; $("cheer").hidden = false;
  } else toast("괜찮아요, 마음은 전해졌을 거예요 💕", false);
  render();
  try {
    await store.updateRequest(id, patch);
    if (log) {
      if (log.task_id && S.tasks[log.task_id]) await store.updateTask(log.task_id, { status: "done", done_by: me, done_at: patch.done_at });
      await store.addLog(log);
    }
    store.notify({ reqReply: id }).catch(() => {});
  } catch (e) { fail(e); }
}
async function cancelRequest(id) {
  const r = S.requests[id]; if (!r) return;
  r.status = "canceled"; render();
  try { await store.updateRequest(id, { status: "canceled" }); } catch (e) { fail(e); }
}

// ---- 칭찬 스티커 ----
let praiseLog = null;
function openPraise(logId) {
  const l = S.logs.find(x => x.id === logId); if (!l) return;
  praiseLog = l;
  $("stSub").textContent = `${l.by}가 한 "${logName(l)}"에 보낼 스티커를 골라요`;
  $("stGrid").innerHTML = STICKERS.map(s => `<button type="button" data-stk="${s.id}"><span>${s.e}</span><span>${esc(s.t)}</span></button>`).join("");
  $("stSheet").hidden = false;
}
async function sendSticker(kind) {
  const l = praiseLog; if (!l) return;
  const row = { id: newId("s"), log_id: l.id, from_p: me, to_p: l.by, kind, created_at: new Date().toISOString() };
  S.stickers.push(row);
  $("stSheet").hidden = true; render();
  toast(`${sticker(kind).e} 칭찬 스티커를 보냈어요!`, false);
  try { await store.addSticker(row); store.notify({ sticker: row.id }).catch(() => {}); } catch (e) { fail(e); }
}
// 받은 스티커는 앱을 열었을 때 한 번 크게 보여줘요
// 본 스티커는 사람별로 기억해요 (한 폰에서 내리/두리를 바꿔 써도 섞이지 않게)
const seenKey = () => "seenStickers:" + me;
const seenList = () => { try { return JSON.parse(localStorage.getItem(seenKey()) || "[]"); } catch (e) { return []; } };
function markSeen(id) { const l = seenList(); if (!l.includes(id)) l.push(id); try { localStorage.setItem(seenKey(), JSON.stringify(l.slice(-300))); } catch (e) {} }
function showNewStickers() {
  if (!$("cheer").hidden) return;
  const seenM = (() => { try { return JSON.parse(localStorage.getItem("seenMsgs:" + me) || "[]"); } catch (e) { return []; } })();
  const freshM = Object.values(S.messages).filter(m => m.to_p === me && !m.del_to && !seenM.includes(m.id)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  if (freshM.length) {
    const m = freshM[freshM.length - 1];
    try { localStorage.setItem("seenMsgs:" + me, JSON.stringify([...seenM, ...freshM.map(x => x.id)].slice(-300))); } catch (e) {}
    $("cheerMallang").innerHTML = mallang(m.from_p, "happy", 110, "hop");
    $("cheerMsg").textContent = `${callName(m.from_p, me)}가 ${m.reply_to ? "답장을" : "메시지를"} 보냈어요 💌`;
    $("cheerPlus").textContent = m.msg;
    $("cheerUndo").hidden = true; $("cheer").hidden = false;
    return;
  }
  const seen = seenList();
  const fresh = S.stickers.filter(x => x.to_p === me && !seen.includes(x.id)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  if (!fresh.length) return;
  const last = fresh[fresh.length - 1];
  const l = S.logs.find(x => x.id === last.log_id);
  fresh.forEach(x => markSeen(x.id));
  const st = sticker(last.kind);
  $("cheerMallang").innerHTML = `<div class="bigsticker">${st.e}</div>`;
  $("cheerMsg").textContent = `${callName(last.from_p, me)}가 칭찬 스티커를 보냈어요!`;
  $("cheerPlus").textContent = `${st.t}${l ? ` · ${logName(l)}` : ""}${fresh.length > 1 ? ` (외 ${fresh.length - 1}개)` : ""}`;
  $("cheerUndo").hidden = true; $("cheer").hidden = false;
}

// ---- 말랑이 만지면 뿅뿅 ----
const POPS = ["뿅!", "뿅뿅", "말랑~", "히히", "💕", "✨", "뽀잉"];
document.addEventListener("pointerdown", e => {
  const m = e.target.closest(".mallang"); if (!m) return;
  m.classList.remove("boing"); void m.getBoundingClientRect(); m.classList.add("boing");
  for (let i = 0; i < 2; i++) {
    const p = document.createElement("span");
    p.className = "pop"; p.textContent = pick(POPS);
    p.style.left = e.clientX + "px"; p.style.top = e.clientY + "px";
    p.style.setProperty("--dx", `${Math.round((Math.random() - .5) * 90)}px`);
    document.body.appendChild(p); setTimeout(() => p.remove(), 950);
  }
  try { navigator.vibrate && navigator.vibrate(12); } catch (x) {}
});
document.addEventListener("animationend", e => { if (e.target.classList && e.target.classList.contains("boing")) e.target.classList.remove("boing"); });

// ---- 메시지 (내리·두리·엄마·아빠) ----
const isPar = () => !!PARENT;
const byTime = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
// 받는 사람 버튼: 엄마·아빠는 딸들에게, 내리·두리는 서로와 엄마·아빠에게
const msgTargets = () => isPar() ? [["내리", "내리"], ["두리", "두리"], ["둘 다", "둘 다"]] : [[other(me), callName(other(me))], ["엄마", "엄마"], ["아빠", "아빠"]];
let msg = { to: null, text: "", reply: null };
function rerollMsg() { msg.text = genMessage(me, msg.to, !!msg.reply); }
function openMsg(replyId = null) {
  const r = replyId && S.messages[replyId];
  msg = { to: r ? r.from_p : (isPar() ? "둘 다" : other(me)), text: "", reply: r ? r.id : null };
  $("msgText").value = "";
  rerollMsg(); renderMsgSheet(); $("msgSheet").hidden = false;
}
function renderMsgSheet() {
  const r = msg.reply && S.messages[msg.reply];
  $("msgHead").textContent = r ? `${callName(r.from_p, me)}에게 답장하기` : "메시지 보내기";
  $("msgToLabel").hidden = !!r; $("msgTo").hidden = !!r;
  $("msgTo").innerHTML = msgTargets().map(([v, label]) => `<button type="button" data-to="${esc(v)}" aria-pressed="${msg.to === v}">${esc(label)}</button>`).join("");
  $("msgPreview").textContent = $("msgText").value.trim() || msg.text;
}
async function sendMsg() {
  const custom = $("msgText").value.trim();
  const tos = msg.to === "둘 다" ? PEOPLE : [msg.to];
  const at = new Date().toISOString();
  const rows = tos.map(to => ({ id: newId("m"), from_p: me, to_p: to, msg: custom || msg.text, heart: false, reply_to: msg.reply, created_at: at }));
  rows.forEach(r => { S.messages[r.id] = r; });
  $("msgSheet").hidden = true; render();
  toast(`${tos.map(t => callName(t, me)).join("·")}에게 ${msg.reply ? "답장을" : "메시지를"} 보냈어요 💌`, false);
  try { for (const r of rows) { await store.addMessage(r); store.notify({ msg: r.id }).catch(() => {}); } } catch (e) { fail(e); }
}
function renderMessages() {
  const inbox = Object.values(S.messages).filter(m => m.to_p === me && !m.del_to).sort(byTime).slice(0, 4);
  $("msgInSec").hidden = !inbox.length;
  $("msgIn").innerHTML = inbox.map(m => {
    const replied = Object.values(S.messages).some(x => x.reply_to === m.id && x.from_p === me);
    return `<div class="card msg"><div class="reqfrom">${mallang(m.from_p, "happy", 40, "")}<span>${esc(callName(m.from_p, me))}</span>${m.reply_to ? `<span class="chip">답장</span>` : ""}<span class="sub">${fmtDay(new Date(m.created_at))}</span></div>
    <p class="reqmsg">${esc(m.msg)}</p>
    <div class="btnrow">${m.heart ? `<span class="heart">💖 하트 보냄</span>` : `<button type="button" class="btn small" data-heart="${esc(m.id)}">💖 하트</button>`}
      <button type="button" class="btn ghost small" data-reply="${esc(m.id)}">${replied ? "또 답장하기" : "답장하기"}</button>
      <button type="button" class="linkbtn" data-delmsg="${esc(m.id)}">삭제</button></div></div>`;
  }).join("");
  const sent = Object.values(S.messages).filter(m => m.from_p === me).sort(byTime).slice(0, 6);
  $("msgSentSec").hidden = !sent.length && !isPar();
  $("msgSent").innerHTML = sent.length ? sent.map(m => {
    const back = Object.values(S.messages).some(x => x.reply_to === m.id && x.to_p === me);
    return `<li><span class="chip c-${esc(m.to_p)}">${esc(callName(m.to_p, me))}</span><span>${esc(m.msg.length > 28 ? m.msg.slice(0, 28) + "…" : m.msg)}</span>
    <span class="when">${fmtDay(new Date(m.created_at))}</span>${m.heart ? `<span class="heart">💖</span>` : ""}${back ? `<span class="heart">답장 옴</span>` : ""}<button type="button" class="linkbtn" data-delmsg="${esc(m.id)}" aria-label="보낸 메시지 삭제">삭제</button></li>`;
  }).join("") : `<li>아직 보낸 메시지가 없어요.</li>`;
}
// 보낸 메시지를 지우면 받은 사람한테서도 사라지고, 받은 메시지를 지우면 내 화면에서만 사라져요
async function deleteMsg(id) {
  const m = S.messages[id]; if (!m) return;
  const mine = m.from_p === me;
  if (!confirm(mine ? `이 메시지를 지울까? ${callName(m.to_p, me)} 화면에서도 사라져.` : "이 메시지를 내 화면에서 지울까?")) return;
  if (mine) delete S.messages[id]; else m.del_to = true;
  render(); toast("메시지를 지웠어요", false);
  try { if (mine) await store.delMessage(id); else await store.updateMessage(id, { del_to: true }); } catch (e) { fail(e); }
}
async function sendHeart(id) {
  const m = S.messages[id]; if (!m || m.heart) return;
  m.heart = true; render(); toast(`${callName(m.from_p, me)}에게 하트를 보냈어요 💖`, false);
  try { await store.updateMessage(id, { heart: true }); store.notify({ heart: id }).catch(() => {}); } catch (e) { fail(e); }
}
function renderParentToday() {
  const done = S.logs.filter(l => l.date === K(now()));
  $("heroMallang").innerHTML = mallang(me, "happy", 112);
  $("greet").textContent = done.length ? `${me}, 오늘 딸들이 집안일 ${done.length}개 했어요!` : `${me}, 오늘 딸들 소식을 기다려요`;
  $("feedSub").textContent = "딸들이 한 일에 칭찬 스티커를 보내 보세요.";
}

function renderToday() {
  const par = isPar();
  document.querySelectorAll("#v-today [data-kid]").forEach(e => { e.hidden = par; });
  document.querySelectorAll("#v-today [data-parent]").forEach(e => { e.hidden = !par; });
  renderMessages();
  if (par) {
    $("inboxSec").hidden = true; $("sentSec").hidden = true; $("weekBanner").hidden = true; $("planDot").hidden = true;
    $("today").textContent = `${now().getMonth() + 1}월 ${now().getDate()}일 ${DAYN[now().getDay()]}요일`;
    $("starPills").innerHTML = PEOPLE.map(p => `<span class="starpill">${STAR()}${p} ${starsOf(p)}개</span>`).join("");
    renderParentToday(); renderFeed();
    return;
  }
  $("feedSub").textContent = "다른 사람이 한 일에 칭찬 스티커를 보내 보세요.";
  const today = now();
  $("today").textContent = `${today.getMonth() + 1}월 ${today.getDate()}일 ${DAYN[today.getDay()]}요일`;
  const due = dueTasks();
  const dailies = dailyPending();
  const n = due.length + dailies.length;
  const moved = due.some(t => (t.postpone_count || 0) >= 2);
  $("heroMallang").innerHTML = mallang(me, n === 0 ? "happy" : moved ? "worried" : "normal", 112);
  $("greet").textContent = n === 0 ? `${me}야, 오늘 할 일 끝! 푹 쉬어` : `${me}야, 오늘 할 일 ${n}개 남았어`;
  $("starPills").innerHTML = PEOPLE.map(p => `<span class="starpill">${STAR()}${p} ${starsOf(p)}개</span>`).join("");
  $("askRow").innerHTML = `<button type="button" class="btn ask" id="askOpen">${MAIL} ${esc(NICK[other(me)])}에게 부탁하기</button><button type="button" class="btn ask" data-compose="1">💌 메시지 보내기</button>`;
  renderRequests();

  // 일요일(토·일) 다음 주 계획 안내
  const nextWk = K(add(thisMonday(), 7));
  const needPlan = [6, 0].includes(today.getDay()) && !(S.weeks[nextWk] && S.weeks[nextWk].planned);
  $("planCallout").innerHTML = needPlan ? `<div class="callout">${mallang(me, "normal", 52, "")}<div class="txt"><b>다음 주 할 일, 무슨 요일에 할까요?</b><a class="btn small" href="#plan">요일 정하기</a></div></div>` : "";
  $("planDot").hidden = !needPlan;

  // 주말 임박
  const wk = K(thisMonday());
  const left = (7 - today.getDay()) % 7;
  const weekLeft = Object.values(S.tasks).filter(t => t.status === "todo" && t.week <= wk && isMine(t.who, me));
  const wb = $("weekBanner");
  if ([5, 6, 0].includes(today.getDay()) && weekLeft.length) {
    const mins = weekLeft.reduce((s, t) => s + chore(t.chore_id).mins, 0);
    wb.hidden = false;
    wb.innerHTML = mallang(me, "normal", 44, "") + `<span>${left ? `이번 주가 ${left}일 남았어요!` : "오늘이 이번 주 마지막 날이에요!"} 남은 일 ${weekLeft.length}개, 다 해도 ${mins}분이에요.</span>`;
  } else wb.hidden = true;

  $("dueCount").textContent = n ? `${n}개` : "";
  const cards = due.map(checkCard);
  for (const dish of dailies) cards.push(`<div class="card due"><div class="top"><div class="main"><span class="name">${esc(dish.name)}</span>
    <span class="meta">${whoChip(dish.who)}<span class="st today">매일${dish.at ? ` ${esc(dish.at)}` : ""}</span><span class="mins">약 ${dish.mins}분</span>${dish.note ? `<span>${esc(dish.note)}</span>` : ""}</span></div></div>
    <div class="acts"><button type="button" class="btn" data-chore="${esc(dish.id)}">${STAR(18)} 했어요</button><span></span></div></div>`);
  $("due").innerHTML = cards.length ? cards.join("") : `<div class="empty">${mallang(me, "happy", 48, "")}<span>오늘 체크할 일이 없어요. 최고예요!</span></div>`;

  const turns = chores().filter(c => c.freq === "turn").map(c => {
    const last = [...S.logs].filter(l => l.chore_id === c.id).sort((a, b) => b.at - a.at)[0];
    const next = last ? other(last.by) : "두리";
    return simpleCard(c, `<span class="chip c-번갈아">이번엔 ${next}</span><span>${esc(c.note || "")}</span>`,
      `<button type="button" class="btn ${next === me ? "" : "ghost "}small" data-chore="${esc(c.id)}">했어요</button>`);
  });
  $("any").innerHTML = turns.join("");

  const restT = Object.values(S.tasks).filter(t => t.status === "todo" && t.week === wk && t.day > K(today) && isMine(t.who, me)).sort((a, b) => a.day.localeCompare(b.day));
  $("rest").innerHTML = restT.length ? restT.map(t => simpleCard(chore(t.chore_id), `${whoChip(t.who)}<span class="st ok">${fmtDay(D(t.day))}</span>`,
    `<button type="button" class="btn ghost small" data-done="${esc(t.id)}">미리 했어요</button>`)).join("")
    : `<div class="empty">이번 주에 남은 일이 없어요.</div>`;

  renderFeed();
  $("rules").innerHTML = RULES.map(r => `<li>${esc(r)}</li>`).join("");
}
function renderFeed() {
  const recent = [...S.logs].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 8);
  $("feed").innerHTML = recent.length ? recent.map(l => {
    const got = S.stickers.filter(x => x.log_id === l.id).map(x => sticker(x.kind).e).join("");
    const btn = l.by !== me ? `<button type="button" class="btn ghost small" data-praise="${esc(l.id)}">칭찬하기</button>` : "";
    return `<li>${STAR()}${whoChip(l.by)}<span>${esc(logName(l))}</span>${got ? `<span class="stk" aria-label="받은 스티커">${got}</span>` : ""}<span class="when">${fmtDay(D(l.date))}</span>${btn}</li>`;
  }).join("") : `<li>아직 모은 별이 없어요. 첫 번째 별의 주인공은 누구?</li>`;
}

// ---- 화면: 계획 ----
async function renderPlan() {
  const today = now();
  if (planWeek === null) planWeek = [6, 0].includes(today.getDay()) ? 1 : 0;
  const monday = add(thisMonday(), planWeek * 7);
  const wk = K(monday);
  await ensureWeek(monday);
  document.querySelectorAll("#planWeekSeg button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.w === planWeek)));
  $("planTitle").textContent = `${planWeek ? "다음 주" : "이번 주"} 계획 · ${monday.getMonth() + 1}/${monday.getDate()}~`;

  const tasks = Object.values(S.tasks).filter(t => t.week === wk);
  const days = WEEK_ORDER.map(d => add(monday, (d + 6) % 7));
  // 내 요일별 시간
  const mineT = tasks.filter(t => isMine(t.who, me));
  const per = days.map(d => mineT.filter(t => t.day === K(d)).reduce((s, t) => s + chore(t.chore_id).mins, 0));
  const max = Math.max(30, ...per);
  $("loadTitle").textContent = `${me}의 요일별 시간`;
  $("load").innerHTML = days.map((d, i) => `<div class="col${K(d) === K(today) ? " today" : ""}"><span>${per[i] ? per[i] + "분" : "&nbsp;"}</span>
    <div class="barwrap"><div class="bar" style="height:${Math.max(3, Math.round((per[i] / max) * 52))}px"></div></div><span class="dayname">${DAYN[d.getDay()]}</span></div>`).join("");

  const order = t => (isMine(t.who, me) ? 0 : 1);
  const sorted = tasks.sort((a, b) => order(a) - order(b) || a.day.localeCompare(b.day) || a.chore_id.localeCompare(b.chore_id));
  $("planList").innerHTML = sorted.length ? sorted.map(t => {
    const c = chore(t.chore_id);
    const done = t.status === "done";
    const chips = days.map(d => {
      const k = K(d), past = k < K(today);
      return `<button type="button" aria-pressed="${t.day === k}" data-move="${esc(t.id)}" data-day="${k}" ${done || past ? "disabled" : ""}>${DAYN[d.getDay()]}<small>${d.getDate()}</small></button>`;
    }).join("");
    return `<div class="card"><div class="top"><div class="main"><span class="name">${esc(c.name)}</span>
      <span class="meta">${whoChip(t.who)}<span class="mins">약 ${c.mins}분</span>${done ? `<span class="donechip">완료 (${esc(t.done_by || "")})</span>` : ""}</span></div></div>
      <div class="days" data-who="${esc(t.who)}" role="group" aria-label="${esc(c.name)} 요일">${chips}</div></div>`;
  }).join("") : `<div class="empty">이 주에는 정해진 일이 없어요.</div>`;

  const w = S.weeks[wk];
  $("planStatus").textContent = w && w.planned ? `${w.planned_by || ""} 님이 정했어요. 바꿔도 괜찮아요.` : "";
  $("planConfirm").textContent = w && w.planned ? "다시 정했어요" : "이대로 정했어요";
}

// ---- 화면: 마이 ----
function renderMy() {
  const p = prefs();
  $("myMallang").innerHTML = mallang(me, "happy", 100);
  if (isPar()) { $("myStars").textContent = `내리·두리를 응원하는 ${me}`; }
  $("myName").textContent = `${me}의 페이지`;
  if (!isPar()) $("myStars").textContent = `지금까지 모은 별 ${starsOf(me)}개 · 받은 칭찬 스티커 ${S.stickers.filter(x => x.to_p === me).length}개`;
  document.querySelectorAll(".who button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.p === me)));
  $("prefAlarm").value = (p[me] && p[me].alarm) || "20:00";
  $("prefCheck").value = (p[me] && p[me].check) || "23:30";
  $("prefPlan").value = p.plan || "21:00";
  document.querySelectorAll("#v-my [data-kid]").forEach(e => { e.hidden = isPar(); });
  if (!isPar() && !$("defaults").dataset.dirty) renderDefaults();
  renderLook();
  refreshPushStatus();
}
function renderLook() {
  const lk = lookOf(me);
  $("lookPreview").innerHTML = mallang(me, "happy", 120);
  $("lookColors").innerHTML = Object.entries(COLORS).map(([k, v]) => `<button type="button" class="swatch" data-color="${k}" aria-pressed="${lk.color === k}" aria-label="${v.name}" title="${v.name}"
    style="background:linear-gradient(135deg, ${v.c[0]}, ${v.c[1]})"></button>`).join("");
  $("lookAccs").innerHTML = Object.entries(ACCS).map(([k, v]) => `<button type="button" data-acc="${k}" aria-pressed="${lk.acc === k}">${v}</button>`).join("");
}
async function setLook(patch) {
  const p = prefs();
  const next = { ...p, [me]: { ...(p[me] || {}), look: { ...lookOf(me), ...patch } } };
  S.household = { ...S.household, prefs: next };
  render();
  try { await store.saveHousehold(S.household); } catch (e) { fail(e); }
}
function dayButtons(name, selected, multi, who) {
  return `<div class="days" role="group" data-who="${esc(who)}" data-group="${name}" data-multi="${multi ? 1 : 0}">${WEEK_ORDER.map(d =>
    `<button type="button" aria-pressed="${selected.includes(d)}" data-pick="${d}">${DAYN[d]}</button>`).join("")}</div>`;
}
function renderDefaults() {
  $("defaults").innerHTML = chores().filter(c => !["daily", "turn"].includes(c.freq)).map(c => {
    const whoSel = c.freq === "alt" ? `<span class="chip c-번갈아">번갈아</span>` :
      `<select data-who="${esc(c.id)}" aria-label="${esc(c.name)} 담당">${["내리", "두리", "같이"].map(w => `<option ${w === c.who ? "selected" : ""}>${w}</option>`).join("")}</select>`;
    const picker = c.freq === "alt"
      ? PEOPLE.map(p => `<div class="field"><span class="chip c-${p}">${p} 차례</span></div>${dayButtons(`${c.id}:${p}`, [c.altDays[p]], false, p)}`).join("")
      : dayButtons(c.id, c.days, true, c.who);
    return `<div class="card" data-chore-card="${esc(c.id)}"><div class="top"><div class="main"><span class="name">${esc(c.name)}</span>
      <span class="meta">${esc(freqLabel(c))}</span></div></div>
      <div class="field">${whoSel}<label>걸리는 시간 <input type="number" min="1" max="180" value="${c.mins}" data-mins="${esc(c.id)}"> 분</label></div>${picker}</div>`;
  }).join("");
}

// ---- 동작 ----
function toast(msg, canUndo) {
  $("toastMsg").textContent = msg; $("undoBtn").hidden = !canUndo; $("toast").hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("toast").hidden = true; }, 6000);
}
const fail = e => { console.error(e); toast("저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.", false); };

function cheer(c) {
  const n = starsOf(me);
  $("cheerMallang").innerHTML = mallang(me, "happy", 120, "hop");
  $("cheerMsg").textContent = n % 10 === 0 ? `별 ${n}개 달성! ${pick(PRAISE)}` : pick(PRAISE);
  $("cheerPlus").textContent = `${c.name} 완료 · 별 +1 (모두 ${n}개)`;
  $("cheerUndo").hidden = false; $("cheer").hidden = false; $("cheerOk").focus();
}
async function complete(taskId, choreId) {
  const t = taskId ? S.tasks[taskId] : null;
  const c = chore(t ? t.chore_id : choreId);
  const log = { id: "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), chore_id: c.id, by: me, date: K(now()), at: Date.now(), task_id: taskId || null };
  undo = { log, task: t ? { ...t } : null };
  S.logs.push(log);
  if (t) Object.assign(t, { status: "done", done_by: me, done_at: new Date().toISOString() });
  render(); cheer(c);
  try {
    if (t) await store.updateTask(t.id, { status: "done", done_by: me, done_at: t.done_at });
    await store.addLog(log);
    // 상대에게 "○○가 ○○을 했어요!" 알림 (되돌리기 시간을 조금 기다렸다가)
    setTimeout(() => { if (S.logs.some(x => x.id === log.id)) store.notify({ did: log.id }).catch(() => {}); }, 8000);
  } catch (e) { fail(e); }
}
async function postpone(taskId) {
  const t = S.tasks[taskId]; if (!t) return;
  const c = chore(t.chore_id);
  undo = { task: { ...t } };
  const patch = { day: K(add(now(), 1)), postpone_count: (t.postpone_count || 0) + 1 };
  Object.assign(t, patch); render();
  toast(patch.postpone_count >= 2 ? `내일로 옮겼어요. 내일은 ${c.mins}분만 내봐요!` : "내일로 옮겼어요. 내일 다시 알려줄게요", true);
  try { await store.updateTask(t.id, patch); } catch (e) { fail(e); }
}
async function doUndo() {
  if (!undo) return; const u = undo; undo = null;
  $("toast").hidden = true; $("cheer").hidden = true;
  if (u.log) S.logs = S.logs.filter(l => l.id !== u.log.id);
  if (u.task) S.tasks[u.task.id] = u.task;
  render();
  try {
    if (u.log) await store.delLog(u.log.id);
    if (u.task) await store.putTask(u.task);
  } catch (e) { fail(e); }
}
async function moveTask(id, day) {
  const t = S.tasks[id]; if (!t || t.day === day) return;
  t.day = day; renderPlan();
  try { await store.updateTask(id, { day }); } catch (e) { fail(e); }
}
async function confirmPlan() {
  const wk = K(add(thisMonday(), planWeek * 7));
  S.weeks[wk] = { monday: wk, planned: true, planned_by: me };
  renderPlan(); render();
  toast(planWeek ? "다음 주 계획 완료! 정한 날에 알려줄게요" : "이번 주 계획을 바꿨어요", false);
  try { await store.setWeek(S.weeks[wk]); } catch (e) { fail(e); }
}
async function savePrefs() {
  const p = prefs();
  const next = { ...p, [me]: { ...(p[me] || {}), alarm: $("prefAlarm").value || "20:00", check: $("prefCheck").value || "23:30" }, plan: $("prefPlan").value || "21:00" };
  S.household = { ...S.household, prefs: next };
  try { await store.saveHousehold(S.household); toast("알림 시간을 저장했어요", false); } catch (e) { fail(e); }
}
async function saveDefaults() {
  const list = chores().map(c => ({ ...c }));
  for (const c of list) {
    const card = document.querySelector(`[data-chore-card="${c.id}"]`);
    if (!card) continue;
    const m = card.querySelector(`[data-mins="${c.id}"]`); if (m) c.mins = Math.max(1, Math.min(180, +m.value || c.mins));
    const w = card.querySelector(`[data-who="${c.id}"]`); if (w) c.who = w.value;
    const picked = g => [...card.querySelectorAll(`[data-group="${g}"] [aria-pressed="true"]`)].map(b => +b.dataset.pick);
    if (c.freq === "alt") { c.altDays = { ...c.altDays }; for (const p of PEOPLE) { const d = picked(`${c.id}:${p}`); if (d.length) c.altDays[p] = d[0]; } }
    else { const d = picked(c.id); if (d.length) c.days = d.sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b)); }
  }
  S.household = { ...S.household, chores: list };
  delete $("defaults").dataset.dirty;
  try {
    await store.saveHousehold(S.household);
    // 아직 정하지 않은 다음 주 계획은 새 기본 요일로 다시 만들어요 (끝낸 일은 그대로)
    const nm = add(thisMonday(), 7), wk = K(nm);
    let msg = "기본 요일을 저장했어요.";
    if (S.weeks[wk] && !S.weeks[wk].planned) {
      const rows = generateWeek(list, nm);
      for (const t of Object.values(S.tasks)) if (t.week === wk && t.status === "todo") delete S.tasks[t.id];
      await store.delWeekTodo(wk);
      rows.forEach(r => { if (!S.tasks[r.id]) S.tasks[r.id] = r; });
      await store.upsertTasks(rows);
      msg += " 다음 주 계획에도 반영했어요.";
    }
    $("defStatus").textContent = msg; $("defStatus").className = "status good";
    renderDefaults(); render();
  } catch (e) { fail(e); }
}

// ---- 푸시 ----
const b64 = s => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(ch => ch.charCodeAt(0))); };
async function refreshPushStatus() {
  const st = $("pushStatus"), on = $("pushOn"), test = $("pushTest");
  const set = (t, cls) => { st.textContent = t; st.className = "status " + (cls || ""); };
  if (store.kind !== "server") { set("알림 서버가 아직 연결되지 않았어요. 연결되면 여기서 켤 수 있어요.", "bad"); on.hidden = true; return; }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    set("이 화면에서는 알림을 받을 수 없어요. 아이폰은 홈 화면에 추가한 앱 아이콘으로 열어 주세요.", "bad"); on.hidden = true; return;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub && Notification.permission === "granted") {
    set(`이 폰으로 ${me} 알림을 받고 있어요.`, "good"); on.hidden = true; test.hidden = false;
    const j = sub.toJSON();
    if (localStorage.getItem("subPerson") !== me) { await store.saveSub({ endpoint: j.endpoint, person: me, p256dh: j.keys.p256dh, auth: j.keys.auth }); localStorage.setItem("subPerson", me); }
  } else {
    set(Notification.permission === "denied" ? "알림이 꺼져 있어요. 폰 설정에서 이 앱의 알림을 허용해 주세요." : "아직 이 폰에서 알림을 받지 않고 있어요.", Notification.permission === "denied" ? "bad" : "");
    on.hidden = Notification.permission === "denied"; test.hidden = true;
  }
}
async function enablePush() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return refreshPushStatus();
    const key = await store.publicKey();
    if (!key) { toast("알림 서버가 아직 준비 중이에요. 잠시 뒤 다시 눌러 주세요.", false); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    const j = sub.toJSON();
    await store.saveSub({ endpoint: j.endpoint, person: me, p256dh: j.keys.p256dh, auth: j.keys.auth });
    localStorage.setItem("subPerson", me);
    toast("알림을 켰어요!", false);
  } catch (e) { fail(e); }
  refreshPushStatus();
}
async function testPush() {
  try { const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription(); await store.notify({ test: sub.endpoint }); toast("테스트 알림을 보냈어요", false); }
  catch (e) { fail(e); }
}

// ---- 화면 전환 ----
function route() {
  const v = (location.hash || "#today").slice(1);
  let view = ["today", "plan", "my"].includes(v) ? v : "today";
  if (view === "plan" && isPar()) view = "today";
  document.querySelector('.tabs [data-tab="plan"]').hidden = isPar();
  document.querySelector(".tabs").style.gridTemplateColumns = isPar() ? "repeat(2, 1fr)" : "";
  for (const name of ["today", "plan", "my"]) $("v-" + name).hidden = name !== view;
  document.querySelectorAll(".tabs a").forEach(a => { if (a.dataset.tab === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  render();
  window.scrollTo(0, 0);
}
function render() {
  if (!S.household) return;
  document.documentElement.dataset.me = me;
  renderToday();
  const v = (location.hash || "#today").slice(1);
  if (v === "plan") renderPlan();
  if (v === "my") renderMy();
}

document.addEventListener("click", e => {
  const el = e.target.closest("button"); if (!el) return;
  if (el.id === "askOpen") return openAsk();
  if (el.dataset.compose) return openMsg();
  if (el.dataset.reply) return openMsg(el.dataset.reply);
  if (el.dataset.to) { msg.to = el.dataset.to; rerollMsg(); return renderMsgSheet(); }
  if (el.id === "msgReroll") { rerollMsg(); return renderMsgSheet(); }
  if (el.id === "msgSend") return sendMsg();
  if (el.id === "msgClose") { $("msgSheet").hidden = true; return; }
  if (el.dataset.heart) return sendHeart(el.dataset.heart);
  if (el.dataset.delmsg) return deleteMsg(el.dataset.delmsg);
  if (el.dataset.color) return setLook({ color: el.dataset.color });
  if (el.dataset.acc) return setLook({ acc: el.dataset.acc });
  if (el.dataset.asktask) {
    const t = S.tasks[el.dataset.asktask];
    ask.task = ask.task && ask.task.task_id === t.id ? null : { task_id: t.id, chore_id: t.chore_id, title: chore(t.chore_id).name };
    if (ask.task) $("askText").value = "";
    return renderAsk();
  }
  if (el.dataset.when) { ask.when = el.dataset.when; return renderAsk(); }
  if (el.dataset.reqdone) return answerRequest(el.dataset.reqdone, true);
  if (el.dataset.reqno) return answerRequest(el.dataset.reqno, false);
  if (el.dataset.reqcancel) return cancelRequest(el.dataset.reqcancel);
  if (el.dataset.praise) return openPraise(el.dataset.praise);
  if (el.dataset.stk) return sendSticker(el.dataset.stk);
  if (el.dataset.done) return complete(el.dataset.done);
  if (el.dataset.chore) return complete(null, el.dataset.chore);
  if (el.dataset.later) return postpone(el.dataset.later);
  if (el.dataset.move) return moveTask(el.dataset.move, el.dataset.day);
  if (el.dataset.w !== undefined) { planWeek = +el.dataset.w; return renderPlan(); }
  if (el.dataset.pick !== undefined) {
    const g = el.closest("[data-group]");
    if (g.dataset.multi === "1") { const on = el.getAttribute("aria-pressed") === "true"; if (on && g.querySelectorAll('[aria-pressed="true"]').length === 1) return; el.setAttribute("aria-pressed", String(!on)); }
    else g.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === el)));
    $("defaults").dataset.dirty = "1"; $("defStatus").textContent = "저장 버튼을 눌러야 바뀌어요"; $("defStatus").className = "status";
    return;
  }
  if (el.dataset.p && !PARENT) { me = el.dataset.p; try { localStorage.setItem("me", me); } catch (x) {} return route(); }
});
$("defaults").addEventListener("input", () => { $("defaults").dataset.dirty = "1"; });
$("undoBtn").addEventListener("click", doUndo);
$("cheerUndo").addEventListener("click", doUndo);
$("cheerOk").addEventListener("click", () => { $("cheer").hidden = true; showNewStickers(); });
$("msgText").addEventListener("input", () => { $("msgPreview").textContent = $("msgText").value.trim() || msg.text; });
$("askText").addEventListener("input", () => { if ($("askText").value.trim()) ask.task = null; renderAsk(); });
$("askReroll").addEventListener("click", () => { ask.i++; renderAsk(); });
$("askSend").addEventListener("click", sendAsk);
$("askClose").addEventListener("click", () => { $("askSheet").hidden = true; });
$("stClose").addEventListener("click", () => { $("stSheet").hidden = true; });
$("planConfirm").addEventListener("click", confirmPlan);
$("saveDefaults").addEventListener("click", saveDefaults);
$("pushOn").addEventListener("click", enablePush);
$("pushTest").addEventListener("click", testPush);
for (const id of ["prefAlarm", "prefCheck", "prefPlan"]) $(id).addEventListener("change", savePrefs);
window.addEventListener("hashchange", route);

async function reload() {
  const data = await store.load();
  S = { household: data.household, tasks: Object.fromEntries(data.tasks.map(t => [t.id, t])), logs: data.logs, weeks: Object.fromEntries(data.weeks.map(w => [w.monday, w])),
    requests: Object.fromEntries((data.requests || []).map(r => [r.id, r])), stickers: data.stickers || [],
    messages: Object.fromEntries((data.messages || []).map(m => [m.id, m])) };
  await ensureWeek(thisMonday());
  render();
  showNewStickers();
}

(async () => {
  store = await createStore(cfg, me);
  if (store.kind === "local") { const n = $("sync"); n.hidden = false; n.textContent = "지금은 이 기기에만 기록돼요. 알림 서버가 연결되면 두 사람 기록이 함께 보여요."; }
  try { await reload(); } catch (e) { console.error(e); const n = $("sync"); n.hidden = false; n.textContent = "기록을 불러오지 못했어요. 인터넷 연결을 확인하고 앱을 다시 열어 주세요."; return; }
  route();
  store.subscribe(() => reload().catch(console.error));
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(console.error);
  setInterval(render, 10 * 60 * 1000);
})();
