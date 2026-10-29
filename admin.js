// 관리 페이지: 집안일 목록 고치기, 별 기록·메시지 지우기, 알림 받는 폰 정리
import { DAYN, WEEK_ORDER, K, add, mondayOf, fmtDay, generateWeek, freqLabel, callName } from "./shared/plan.js";
import { createStore } from "./store.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const FREQ = { weekly: "매주", biweekly: "2주에 한 번", monthly: "한 달에 한 번 (첫 주)", daily: "매일", turn: "필요할 때 번갈아", alt: "주마다 번갈아" };
const WHO = ["내리", "두리", "같이"];

let store, data, chores = [];
const toastAt = { t: null };
function toast(msg) { $("toastMsg").textContent = msg; $("toast").hidden = false; clearTimeout(toastAt.t); toastAt.t = setTimeout(() => { $("toast").hidden = true; }, 4000); }
const fail = e => { console.error(e); toast("저장하지 못했어요. 인터넷 연결을 확인해 주세요."); };

// ---- 집안일 ----
function dayRow(key, picked, who) {
  return `<div class="days" data-who="${esc(who)}" data-group="${esc(key)}" role="group">${WEEK_ORDER.map(d =>
    `<button type="button" data-day="${d}" aria-pressed="${picked.includes(d)}">${DAYN[d]}</button>`).join("")}</div>`;
}
function choreCard(c, i) {
  const whoField = c.freq === "alt" || c.freq === "turn" ? `<span class="chip c-번갈아">번갈아</span>`
    : `<select data-f="who" aria-label="담당">${WHO.map(w => `<option ${w === c.who ? "selected" : ""}>${w}</option>`).join("")}</select>`;
  const days = ["weekly", "biweekly", "monthly"].includes(c.freq) ? dayRow(`d${i}`, c.days || [], c.who)
    : c.freq === "alt" ? ["내리", "두리"].map(p => `<div class="field"><span class="chip c-${p}">${p} 차례</span></div>${dayRow(`a${i}:${p}`, [c.altDays?.[p] ?? 0], p)}`).join("")
    : "";
  const at = c.freq === "daily" ? `<label>알림 시각 <input type="time" data-f="at" value="${esc(c.at || "")}"></label><span class="sub">비워 두면 밤 체크 알림에만 나와요</span>` : "";
  return `<div class="card" data-i="${i}">
    <div class="field"><input type="text" data-f="name" value="${esc(c.name)}" maxlength="30" aria-label="이름" class="namein"><button type="button" class="linkbtn" data-del="${i}">삭제</button></div>
    <div class="field">${whoField}
      <select data-f="freq" aria-label="얼마나 자주">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}" ${k === c.freq ? "selected" : ""}>${v}</option>`).join("")}</select>
      <label><input type="number" min="1" max="180" data-f="mins" value="${c.mins}" aria-label="걸리는 시간"> 분</label></div>
    ${days}
    <div class="field">${at}<input type="text" data-f="note" value="${esc(c.note || "")}" maxlength="30" placeholder="메모 (예: 빗자루·물티슈)" aria-label="메모"></div>
    <span class="meta">${esc(freqLabel(c))}</span></div>`;
}
function renderChores() {
  $("choreCount").textContent = `${chores.length}개`;
  $("chores").innerHTML = chores.map(choreCard).join("");
}
// 화면에 입력된 값을 chores에 옮겨요
function readCard(card) {
  const c = chores[+card.dataset.i];
  const val = f => card.querySelector(`[data-f="${f}"]`)?.value;
  c.name = (val("name") || "").trim() || c.name;
  c.mins = Math.max(1, Math.min(180, +val("mins") || c.mins));
  c.note = (val("note") || "").trim() || undefined;
  if (val("who")) c.who = val("who");
  const freq = val("freq");
  if (freq !== c.freq) {
    c.freq = freq;
    if (["weekly", "biweekly", "monthly"].includes(freq) && !c.days?.length) c.days = [0];
    if (freq === "alt") { c.who = "번갈아"; c.altDays = c.altDays || { "두리": 4, "내리": 5 }; c.first = c.first || "두리"; }
    if (freq === "turn") c.who = "번갈아";
    if ((freq === "alt" || freq === "turn") === false && c.who === "번갈아") c.who = "같이";
  }
  if (c.freq === "daily") c.at = val("at") || undefined; else delete c.at;
  const picked = g => [...card.querySelectorAll(`[data-group="${g}"] [aria-pressed="true"]`)].map(b => +b.dataset.day);
  const i = card.dataset.i;
  if (["weekly", "biweekly", "monthly"].includes(c.freq) && card.querySelector(`[data-group="d${i}"]`)) c.days = picked(`d${i}`);
  if (c.freq === "alt") for (const p of ["내리", "두리"]) { const d = picked(`a${i}:${p}`); if (d.length) c.altDays[p] = d[0]; }
}
const readAll = () => document.querySelectorAll("#chores [data-i]").forEach(readCard);
const newChoreId = () => "c" + Date.now().toString(36);

async function saveChores() {
  readAll();
  const bad = chores.find(c => ["weekly", "biweekly", "monthly"].includes(c.freq) && !c.days.length);
  if (bad) { $("choreStatus").textContent = `"${bad.name}" 요일을 하나 이상 골라 주세요`; return; }
  try {
    await store.saveHousehold({ ...data.household, chores });
    if ($("applyNow").checked) {
      const monday = mondayOf(new Date()), wk = K(monday);
      await store.delWeekTodo(wk);
      await store.upsertTasks(generateWeek(chores, monday, K(new Date())));
    }
    $("choreStatus").textContent = "저장했어요"; $("applyNow").checked = false;
    renderChores();
  } catch (e) { fail(e); }
}

// ---- 기록 ----
const choreName = l => l.title || chores.find(c => c.id === l.chore_id)?.name || l.chore_id;
function renderLogs() {
  const logs = [...data.logs].sort((a, b) => (b.at || 0) - (a.at || 0));
  $("logCount").textContent = `모두 ${logs.length}개`;
  $("logs").innerHTML = logs.length ? logs.slice(0, 40).map(l => `<li><span class="chip c-${esc(l.by)}">${esc(l.by)}</span><span>${esc(choreName(l))}</span>
    <span class="when">${fmtDay(new Date(l.at || l.date))}</span><button type="button" class="linkbtn" data-dellog="${esc(l.id)}">삭제</button></li>`).join("") : `<li>아직 기록이 없어요.</li>`;
}
function renderMsgs() {
  const msgs = [...data.messages].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  $("msgs").innerHTML = msgs.length ? msgs.slice(0, 40).map(m => `<li><span class="chip c-${esc(m.from_p)}">${esc(m.from_p)}</span>→<span class="chip c-${esc(m.to_p)}">${esc(m.to_p)}</span>
    <span>${esc(m.msg.length > 30 ? m.msg.slice(0, 30) + "…" : m.msg)}</span><span class="when">${fmtDay(new Date(m.created_at))}</span>
    <button type="button" class="linkbtn" data-delmsg="${esc(m.id)}">삭제</button></li>`).join("") : `<li>최근 메시지가 없어요.</li>`;
}
async function renderSubs() {
  const subs = await store.listSubs().catch(() => []);
  const device = e => { try { const h = new URL(e).host; return h.includes("apple") ? "아이폰" : h.includes("google") ? "안드로이드·크롬" : h.includes("mozilla") ? "파이어폭스" : h; } catch (x) { return "기기"; } };
  $("subs").innerHTML = subs.length ? subs.map(s => `<li><span class="chip c-${esc(s.person)}">${esc(s.person)}</span><span>${esc(device(s.endpoint))}</span>
    <span class="when">${s.created_at ? fmtDay(new Date(s.created_at)) + " 켬" : ""}</span>
    <button type="button" class="btn ghost small" data-test="${esc(s.endpoint)}">테스트</button><button type="button" class="linkbtn" data-delsub="${esc(s.endpoint)}">삭제</button></li>`).join("")
    : `<li>${store.kind === "local" ? "알림 서버가 연결되면 보여요." : "아직 알림을 켠 폰이 없어요."}</li>`;
}

function renderLinks() {
  const base = location.href.replace(/admin\.html.*$/, "");
  $("links").innerHTML = [["내리·두리", ""], ["엄마", "mom.html"], ["아빠", "dad.html"]].map(([who, page]) =>
    `<li><span class="chip c-${who === "내리·두리" ? "같이" : who}">${who}</span><a href="${esc(base + page)}">${esc(base + page)}</a></li>`).join("");
}

document.addEventListener("click", async e => {
  const el = e.target.closest("button"); if (!el) return;
  if (el.dataset.day !== undefined) {
    const g = el.closest("[data-group]"), multi = g.dataset.group.startsWith("d");
    if (multi) el.setAttribute("aria-pressed", String(el.getAttribute("aria-pressed") !== "true"));
    else g.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === el)));
    $("choreStatus").textContent = "저장 버튼을 눌러야 바뀌어요";
    return;
  }
  if (el.id === "addChore") {
    readAll();
    chores.push({ id: newChoreId(), name: "새 집안일", who: "같이", mins: 10, freq: "weekly", days: [0] });
    renderChores(); $("choreStatus").textContent = "저장 버튼을 눌러야 바뀌어요";
    document.querySelector("#chores [data-i]:last-child .namein")?.select();
    return;
  }
  if (el.dataset.del !== undefined) {
    readAll();
    const c = chores[+el.dataset.del];
    if (!confirm(`"${c.name}"을(를) 목록에서 지울까요? 저장해야 반영돼요.`)) return;
    chores.splice(+el.dataset.del, 1); renderChores(); $("choreStatus").textContent = "저장 버튼을 눌러야 바뀌어요";
    return;
  }
  if (el.id === "saveChores") return saveChores();
  if (el.dataset.dellog) {
    const l = data.logs.find(x => x.id === el.dataset.dellog);
    if (!l || !confirm(`${l.by}의 "${choreName(l)}" 기록을 지울까요? 별도 하나 빠져요.`)) return;
    try {
      await store.delLog(l.id);
      if (l.task_id) await store.updateTask(l.task_id, { status: "todo", done_by: null, done_at: null }).catch(() => {});
      data.logs = data.logs.filter(x => x !== l); renderLogs(); toast("기록을 지웠어요");
    } catch (x) { fail(x); }
    return;
  }
  if (el.dataset.delmsg) {
    if (!confirm("이 메시지를 모두에게서 지울까요?")) return;
    try { await store.delMessage(el.dataset.delmsg); data.messages = data.messages.filter(m => m.id !== el.dataset.delmsg); renderMsgs(); toast("메시지를 지웠어요"); } catch (x) { fail(x); }
    return;
  }
  if (el.dataset.delsub) {
    if (!confirm("이 폰의 알림을 끌까요? 그 폰에서 다시 켤 수 있어요.")) return;
    try { await store.delSub(el.dataset.delsub); renderSubs(); toast("지웠어요"); } catch (x) { fail(x); }
    return;
  }
  if (el.dataset.test) { try { await store.notify({ test: el.dataset.test }); toast("테스트 알림을 보냈어요"); } catch (x) { fail(x); } }
});
$("chores").addEventListener("change", e => { if (e.target.dataset.f === "freq" || e.target.dataset.f === "who") { readAll(); renderChores(); } $("choreStatus").textContent = "저장 버튼을 눌러야 바뀌어요"; });

(async () => {
  store = await createStore(self.APP_CONFIG || {}, "관리");
  if (store.kind === "local") { $("sync").hidden = false; $("sync").textContent = "지금은 이 기기 기록만 보여요."; }
  data = await store.load();
  chores = JSON.parse(JSON.stringify(data.household.chores));
  renderLinks(); renderChores(); renderLogs(); renderMsgs(); renderSubs();
})().catch(e => { console.error(e); $("sync").hidden = false; $("sync").textContent = "불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요."; });
