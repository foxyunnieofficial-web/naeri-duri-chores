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

// ---- 서로에게 부탁하기 ----
// 받는 사람을 부르는 호칭 (두리가 보내면 "언니", 내리가 보내면 "세계최고귀염둥이두리")
export const NICK = { "내리": "언니", "두리": "세계최고귀염둥이두리" };
const ASK = {
  // 두리 → 언니
  "두리": [
    "{n}~~~!!! 💕 우주 최강 멋쟁이 우리 {n}! {w} {t} 한 번만 해주면 안 돼요? 해주면 {n} 평생 업고 다닐게요 🥺💖",
    "세상에서 제일 착하고 예쁘고 똑똑한 {n}… 🥹 {w} {t} 부탁드려도 될까요? {n} 없으면 나 진짜 못 살아 💗💗",
    "{n} 사랑해 사랑해 사랑해 💘 (세 번 말했으니까) {w} {t} 해주면 안 될까용? 뿌잉뿌잉 🐣",
    "똑똑~ {n}의 영원한 팬 두리예요 🙋‍♀️ {w} {t} 해주시면 오늘부터 {n} 팬클럽 회장 할게요 📣💕",
    "{n}!!! 지구에서 제일 다정한 {n}!!! {w} {t} 부탁해도 돼요? 해주면 하트 백만 개 드림 💖💖💖",
    "{n}… 나 {n}가 세상에서 제일 좋아 🥺 그래서 말인데… {w} {t} 해줄 수 있어요? 헤헤 사랑해요 💞",
  ],
  // 내리 → 세계최고귀염둥이두리
  "내리": [
    "{n}야~~~ 🌟 오늘도 귀여움 폭발한 우리 {n}! {w} {t} 부탁해도 될까? 해주면 언니가 볼 꼬집꼬집 해줄게 💖",
    "세상에… 이렇게 귀여운 생명체가 내 동생이라니 🥹 {n}야, {w} {t} 해줄 수 있어? 해주면 언니가 우주만큼 사랑해줄게 🌌💕",
    "{n}야 {n}야 우리 {n}야 💗 {w} {t} 한 번만 부탁할게! 너 없으면 이 집 안 돌아가 진짜 😭💞",
    "📢 긴급 속보: {n}, 오늘도 귀여움 신기록 경신! 그런 {n}에게 {w} {t} 부탁이 도착했습니다 💌 해주면 언니가 맛있는 거 쏜다 🍰",
    "말랑말랑 귀염뽀짝 {n}야~ 🍡 {w} {t} 해주면 언니가 평생 네 편 할게! 사랑해 쪽 💋",
    "{n}야, 너는 존재 자체가 효도야 🥹✨ 근데 효도 하나만 더… {w} {t} 부탁해도 될까? 사랑해 💕",
  ],
};
const THANKS = {
  // 해준 사람이 두리 → 부탁한 언니에게
  "두리": [
    "{n}! 부탁한 {t} 두리가 해냈어요 💪✨ 칭찬해주세요 🥺💕",
    "{n}~ {t} 끝! 이제 {n}는 푹 쉬어요 🛋️💖 사랑해요!",
    "미션 완료 🫡 {t} 다 했어요! {n} 웃는 얼굴 보려고 열심히 했어요 💗",
  ],
  // 해준 사람이 내리 → 부탁한 세계최고귀염둥이두리에게
  "내리": [
    "{n}야, 부탁한 {t} 언니가 다 해놨어! 🫶 고맙다는 말 대신 뽀뽀 💋",
    "{n}의 부탁이라면 언제든지 💪 {t} 끝냈어! 귀여운 게 죄다 진짜 💖",
    "짜잔~ {t} 완료 ✨ {n}야 오늘도 귀여워줘서 고마워 💕",
  ],
};
const SORRY = {
  "두리": ["{n} 미안해요 🥺 지금은 {t} 못 할 것 같아요… 대신 사랑은 듬뿍 보낼게요 💕", "{n}… 오늘은 {t} 어려울 것 같아요 😢 다음엔 꼭 해줄게요! 사랑해요 💗"],
  "내리": ["{n}야, 미안 🥺 지금은 {t} 어려울 것 같아! 다음엔 꼭 해줄게 💗", "{n}야 언니가 오늘은 {t} 힘들 것 같아 😢 대신 꼭 안아줄게 🤗💕"],
};
const fill = (tpl, n, t, w = "") => tpl.replaceAll("{n}", n).replaceAll("{t}", t).replaceAll("{w}", w).replace(/\s+/g, " ").trim();
export const WHEN = { today: "오늘", tomorrow: "내일", week: "이번 주 안에" };
export const askCount = from => ASK[from].length;
export function askMessage(from, task, when, i = 0) {
  const list = ASK[from];
  return fill(list[((i % list.length) + list.length) % list.length], NICK[other(from)], task, WHEN[when] || "");
}
export const askTitle = from => (from === "두리" ? "두리가 언니에게 부탁했어요 💌" : "언니가 세계최고귀염둥이두리에게 부탁했어요 💌");
// doer = 부탁받은 사람, 메시지는 부탁한 사람에게 가요
export function replyMessage(doer, task, ok) {
  const list = (ok ? THANKS : SORRY)[doer];
  return fill(list[Math.floor(Math.random() * list.length)], NICK[other(doer)], task);
}
export const replyTitle = (doer, ok) => ok ? `${doer === "두리" ? "두리" : "언니"}가 부탁을 들어줬어요 💖` : "지금은 어렵대요 🥺";

// ---- 했어요 알림과 칭찬 스티커 ----
// 받침이 있으면 "을", 없으면 "를"
export const eulReul = word => {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? "을" : "를";
};
export const didTitle = (by, choreName) => `${by}가 ${choreName}${eulReul(choreName)} 했어요!`;
export const STICKERS = [
  { id: "crown", e: "👑", t: "최고!" },
  { id: "heart", e: "💖", t: "사랑해" },
  { id: "hundred", e: "💯", t: "완벽해" },
  { id: "clap", e: "👏", t: "잘했어" },
  { id: "sparkle", e: "✨", t: "반짝반짝" },
  { id: "hug", e: "🤗", t: "고마워" },
];
export const sticker = id => STICKERS.find(s => s.id === id) || STICKERS[0];
// 받는 사람 입장에서 보낸 사람 부르기
export const callName = from => (from === "내리" ? "언니" : from === "엄마" ? "엄마" : "두리");

// ---- 엄마 ----
export const MOM = "엄마";
const MOM_OPEN = ["우리 {n}야~", "사랑하는 우리 {n}에게 💌", "{n}야, 엄마야 😊", "세상에서 제일 예쁜 우리 {n}!", "엄마 보물 {n}야", "우리 집 자랑 {n}야~", "{n}야 잘 지내고 있지?"];
const MOM_BODY = [
  "오늘도 밥은 잘 챙겨 먹었니? 바빠도 끼니는 꼭 챙겨 🍚",
  "{s}랑 집안일 나눠서 척척 하는 거 보면 엄마는 너무 뿌듯해",
  "요즘 많이 바쁘지? 너무 무리하지 말고 쉬엄쉬엄 해",
  "집 깨끗하게 해놓고 사는 거 엄마가 다 보고 있다 👀 칭찬해!",
  "날씨가 쌀쌀해졌어. 따뜻하게 입고 다녀 🧣",
  "엄마는 우리 딸 덕분에 매일 힘이 나",
  "힘든 일 있으면 언제든 엄마한테 전화해 📞",
  "{s}랑 사이좋게 지내고 있지? 둘이 같이 있으니 엄마 마음이 든든해",
  "오늘 하루도 정말 수고 많았어",
  "잠은 푹 자고 다니지? 건강이 최고야 💪",
  "물 많이 마시고, 과일도 챙겨 먹어 🍎",
  "우리 딸 혼자서도 이렇게 잘하니까 엄마가 걱정이 없다",
];
const MOM_CLOSE = ["사랑해 💕", "엄마가 늘 응원해 🌷", "보고 싶다 우리 딸 🥰", "항상 고맙고 사랑해 💗", "다음에 맛있는 거 해줄게 🍲", "꼭 안아주고 싶다 🤗", "오늘도 화이팅! 💪"];
// 부를 때마다 새로 섞어서 만들어요
export function momMessage(to) {
  const r = a => a[Math.floor(Math.random() * a.length)];
  const s = to === "내리" ? "두리" : "언니";
  return [r(MOM_OPEN), r(MOM_BODY), r(MOM_CLOSE)].join(" ").replaceAll("{n}", to).replaceAll("{s}", s);
}

// ---- 말랑이 꾸미기 ----
export const COLORS = {
  peach: { name: "복숭아", c: ["#ffd2c6", "#ff9b85"] },
  sky: { name: "하늘", c: ["#bfe0ff", "#8cc4ff"] },
  mint: { name: "민트", c: ["#c4f0d3", "#8fd8a8"] },
  lemon: { name: "레몬", c: ["#fff1b8", "#ffd45c"] },
  lilac: { name: "라일락", c: ["#e6d9ff", "#b99cff"] },
  pink: { name: "딸기우유", c: ["#ffd6e8", "#ff9cc8"] },
  cocoa: { name: "코코아", c: ["#efdccb", "#c9a383"] },
};
export const ACCS = { none: "없음", ribbon: "리본", sprout: "새싹", crown: "왕관", beret: "베레모", glasses: "안경", flower: "꽃", headphones: "헤드폰", star: "별 핀" };
export const DEFAULT_LOOK = { "내리": { color: "peach", acc: "ribbon" }, "두리": { color: "sky", acc: "sprout" }, "엄마": { color: "lilac", acc: "flower" }, "같이": { color: "mint", acc: "none" } };
