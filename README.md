# 내리두리 집안일

내리와 두리가 함께 쓰는 집안일 분배 앱이에요. 휴대폰 홈 화면에 설치하는 웹앱(PWA)이고, 정해진 시간에 푸시 알림을 보내요.

- **오늘**: 오늘 할 일 체크(했어요 / 내일로 미루기), 칭찬과 별 모으기, 주말 임박 안내
- **계획**: 이번 주·다음 주 할 일을 무슨 요일에 할지 고르기 (일요일 밤 알림)
- **마이**: 나는 누구, 알림 켜기와 시간, 기본 요일·담당·걸리는 시간

## 구조
- 앱 화면: `index.html`, `styles.css`, `app.js`, `store.js`, `shared/plan.js` (GitHub Pages)
- 알림: `sw.js`(서비스 워커), `supabase/functions/tick`(5분마다 실행되는 알림 서버)
- 데이터: Supabase (`supabase/migrations`)
- 배포: 앱 화면은 GitHub Pages가 `main` 브랜치를 그대로 열어줘요. 알림 서버와 데이터베이스는 `.github/workflows/deploy.yml`이 배포해요

## 설정
`config.js`에 Supabase 프로젝트 주소와 공개용(anon) 키를 넣고, 저장소 Secrets에 `SUPABASE_ACCESS_TOKEN`을 넣어요.

## 세 가지 앱 주소
- 내리·두리: `https://foxyunnieofficial-web.github.io/naeri-duri-chores/`
- 엄마: `.../naeri-duri-chores/mom.html`
- 아빠: `.../naeri-duri-chores/dad.html`

엄마·아빠 앱은 자기가 주고받은 메시지와 자기가 보낸 스티커만 불러와요. 화면에서 서로가 보이지 않게 나눈 것이고, 같은 서버를 쓰기 때문에 기술적으로 완전히 잠긴 건 아니에요.
`mom.html`, `dad.html`은 `index.html`로 만들어요. `index.html`을 고친 뒤 `node tools/make-parent-pages.mjs`를 실행해 주세요.
