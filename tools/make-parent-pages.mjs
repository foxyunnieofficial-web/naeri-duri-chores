// index.html을 바탕으로 엄마용(mom.html)·아빠용(dad.html) 페이지와 앱 설치 정보를 만들어요.
// index.html을 고친 뒤에는 `node tools/make-parent-pages.mjs`를 다시 실행해 주세요.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const index = readFileSync(new URL("index.html", root), "utf8");
const manifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", root), "utf8"));

for (const [who, page] of [["엄마", "mom"], ["아빠", "dad"]]) {
  const html = index
    .replace("<title>내리두리 집안일</title>", `<title>내리두리 ${who}</title>`)
    .replace('content="내리두리"', `content="내리두리 ${who}"`)
    .replace('href="manifest.webmanifest"', `href="manifest-${page}.webmanifest"`)
    .replace('<script src="config.js"></script>', `<script>self.APP_MODE = "${who}";</script>\n<script src="config.js"></script>`);
  if (!html.includes(`self.APP_MODE = "${who}"`)) throw new Error("index.html 구조가 바뀌었어요");
  const note = "<!-- tools/make-parent-pages.mjs가 index.html로 만든 파일이에요. 직접 고치지 마세요. -->";
  writeFileSync(new URL(`${page}.html`, root), html.replace("<!doctype html>\n", `<!doctype html>\n${note}\n`));
  writeFileSync(new URL(`manifest-${page}.webmanifest`, root), JSON.stringify({
    ...manifest, id: `./${page}.html`, name: `내리두리 ${who}`, short_name: `내리두리 ${who}`, start_url: `./${page}.html#today`,
  }, null, 2) + "\n");
}
