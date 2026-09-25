# 테니스씬 앱 (Expo · React Native)

웹(`../`)과 **같은 서버·같은 데이터**를 쓰는 네이티브 앱이다. 화면만 새로 그렸다.

- 피드·검색·글 상세는 웹 서버 API(`/api/feed` `/api/search` `/api/posts/:id`)를 부른다
- 로그인은 Supabase 를 직접 쓰고, 글쓰기·좋아요는 그 토큰을 API 에 실어 보낸다 — 웹과 같다
- 타입은 웹의 `src/lib/types.ts` 를 **타입만** 가져온다(`@shared/types`). 서버가 바뀌면 여기서 타입 오류가 난다
- 관리자 화면은 웹에만 있다(프로필 → 관리자 → 브라우저로 열림)

## 폰에서 바로 보기 (Xcode 필요 없음)

1. 폰에 **Expo Go** 앱을 설치한다 (앱스토어 / 플레이스토어)
2. 이 폴더에서 실행한다 (Node 24 — `.nvmrc`)
   ```bash
   nvm use && npx expo start
   ```
3. 터미널에 뜬 QR 을 찍는다. 아이폰은 카메라 앱, 안드로이드는 Expo Go 안에서 찍는다.
   맥과 폰이 **같은 와이파이**여야 한다. 안 되면 `npx expo start --tunnel`

## 스토어에 올리기

EAS(Expo 클라우드)가 빌드한다. 로컬 Xcode·Android Studio 가 없어도 된다.

```bash
npx eas-cli@latest login          # Expo 계정
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview   # 설치용 APK
npx eas-cli@latest build --platform ios                          # 애플 개발자 계정($99/년) 필요
```

번들 ID 는 `com.tennisscene.app` 이다(app.json). **스토어에 처음 올린 뒤에는 못 바꾼다.**
도메인을 정했으면 그 전에 바꿀 것.

## 규칙

`../CLAUDE.md` 의 규칙을 그대로 따른다 — 피드 하나, 봇도 같은 카드, 시간순, 글자 크기 13·15·20, 흑백.
색·글자는 `src/lib/theme.ts` 에 있고 웹 `globals.css` 와 같은 값이다. 한쪽만 바꾸지 않는다.

| 할 일 | 명령 |
|---|---|
| 타입 검사 | `npm run typecheck` |
| 린트 | `npm run lint` |
| 웹 로고가 바뀌었을 때 | `npm run sync-logo` |
| 아이콘 다시 그리기 | `npm run icons` |
