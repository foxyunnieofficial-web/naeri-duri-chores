// 집안일 정의와 주간 계획 만들기. 앱(브라우저)과 알림 서버(Supabase Edge Function)가 같이 씁니다.
// 요일 숫자: 0=일 1=월 … 6=토. 한 주는 월요일부터 일요일까지.

export const PEOPLE = ["내리", "두리"];
export const DAYN = ["일", "월", "화", "수", "목", "금", "토"];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// freq: weekly(매주 days 요일마다) · biweekly(격주) · monthly(매달 첫 주) · alt(주마다 번갈아, 사람마다 요일) · daily · turn(차면 차례대로)
export const DEFAULT_CHORES = [
  { id: "vacuum",    name: "청소기 돌리기",            who: "내리",  mins: 20, freq: "weekly",   days: [3, 6] },
  { id: "mop",       name: "바닥 밀대",                who: "두리",  mins: 15, freq: "weekly",   days: [3, 6], note: "청소기 다음에" },
  { id: "toilet",    name: "변기·세면대 청소",         who: "두리",  mins: 15, freq: "weekly",   days: [6] },
  { id: "bathfloor", name: "화장실 바닥 청소",         who: "내리",  mins: 20, freq: "biweekly", days: [0] },
  { id: "rug",       name: "러그 털기·소파 돌돌이",    who: "내리",  mins: 10, freq: "weekly",   days: [0] },
  { id: "entry",     name: "현관 청소",                who: "두리",  mins: 10, freq: "weekly",   days: [0], note: "빗자루·물티슈" },
  { id: "steam",     name: "스팀청소기·소파쿠션 털기", who: "같이",  mins: 40, freq: "monthly",  days: [0] },
  { id: "food",      name: "음식물 쓰레기 내놓기",     who: "번갈아", mins: 5, freq: "alt",      altDays: { "두리": 4, "내리": 5 }, first: "두리", note: "겨울" },
  { id: "dishes",    name: "그릇 정리하기",            who: "내리",  mins: 10, freq: "daily" },
  { id: "recycle",   name: "재활용 내놓기",            who: "번갈아", mins: 10, freq: "turn",    note: "70% 차면" },
];
export const DEFAULT_PREFS = {
  "내리": { alarm: "20:00", check: "23:30" },
  "두리": { alarm: "20:00", check: "23:30" },
  plan: "21:00",
};
export const RULES = ["밥 먹고 테이블 닦기", "물건 쓰면 제자리에", "설거지는 지금처럼 적당히", "두루마리·각티슈·물티슈 다 쓰면 리필"];
export const PRAISE = ["잘했어요!", "최고!", "역시 너밖에 없어", "오늘도 해냈다!", "집이 반짝반짝해졌어요", "말랑이가 감동했어요",
  "진짜 멋져요", "이 집의 자랑!", "완벽해요!", "우리 집 살림왕", "해낼 줄 알았어!", "덕분에 집이 좋아졌어요"];

// 격주·번갈아의 기준 주(월요일)
export const ANCHOR = "2026-11-02";

export const D = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const K = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const add = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const diff = (a, b) => Math.round((D(K(a)) - D(K(b))) / 864e5);
export const mondayOf = d => add(d, -((d.getDay() + 6) % 7));
export const dayInWeek = (monday, dow) => add(monday, (dow + 6) % 7);
export const fmtDay = d => `${d.getMonth() + 1}/${d.getDate()}(${DAYN[d.getDay()]})`;
export const other = p => (p === "내리" ? "두리" : "내리");
const weekIndex = monday => Math.round(diff(monday, D(ANCHOR)) / 7);
const even = n => ((n % 2) + 2) % 2 === 0;

export function altWho(chore, monday) {
  return even(weekIndex(monday)) ? chore.first : other(chore.first);
}

// 한 주의 기본 계획. id가 정해져 있어서 여러 번 만들어도 겹치지 않아요.
// fromDay를 주면 그 날짜 이전 일은 빼요 (주 중간에 처음 시작할 때).
export function generateWeek(chores, monday, fromDay = "") {
  const wk = K(monday);
  const out = [];
  const push = (c, who, dow, slot) => out.push({ id: `${wk}_${c.id}_${slot}`, week: wk, chore_id: c.id, who, day: K(dayInWeek(monday, dow)), status: "todo", postpone_count: 0 });
  for (const c of chores) {
    if (c.freq === "weekly") c.days.forEach((d, i) => push(c, c.who, d, i));
    if (c.freq === "biweekly" && even(weekIndex(monday))) c.days.forEach((d, i) => push(c, c.who, d, i));
    if (c.freq === "monthly") {
      // 그 달의 첫째 주(그 주의 일요일이 1~7일)에만
      const sun = add(monday, 6);
      if (sun.getDate() <= 7) c.days.forEach((d, i) => push(c, c.who, d, i));
    }
    if (c.freq === "alt") { const who = altWho(c, monday); push(c, who, c.altDays[who], 0); }
  }
  return out.filter(t => t.day >= fromDay).sort((a, b) => a.day.localeCompare(b.day));
}

export const isMine = (who, me) => who === me || who === "같이";

export function freqLabel(c) {
  const days = (c.days || []).slice().sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b)).map(d => DAYN[d]).join("·");
  if (c.freq === "weekly") return `주 ${c.days.length}회 (${days})`;
  if (c.freq === "biweekly") return `2주에 1번 (${days})`;
  if (c.freq === "monthly") return `월 1회 (첫 주 ${days})`;
  if (c.freq === "alt") return `주 1회 번갈아 (두리 ${DAYN[c.altDays["두리"]]}·내리 ${DAYN[c.altDays["내리"]]})`;
  if (c.freq === "daily") return "매일";
  if (c.freq === "turn") return c.note || "필요할 때";
  return "";
}

export function nudgeText(c, count) {
  if (count <= 0) return "";
  if (count === 1) return `한 번 미룬 일이에요. ${c.mins}분이면 끝나요!`;
  if (count === 2) return `벌써 두 번 미뤘어요. ${c.mins}분밖에 안 걸려요!`;
  return `${count}번째 미루는 중… 딱 ${c.mins}분만 해볼까요? 말랑이가 옆에서 응원할게요`;
}
