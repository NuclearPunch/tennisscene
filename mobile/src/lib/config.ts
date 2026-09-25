/**
 * 앱 설정. **전부 공개해도 되는 값이다.**
 *
 * Supabase 공개 키(publishable)는 웹 번들에도 그대로 들어 있고, 데이터를 지키는 건 RLS 다.
 * 비밀 키(service_role)나 DB 비밀번호는 절대 여기 두지 않는다 — 앱은 누구나 뜯어볼 수 있다.
 *
 * .env 가 아니라 코드에 두는 이유: 루트 .gitignore 가 .env* 를 막아서 클라우드 빌드(EAS)에
 * 파일이 안 올라간다. 공개 값이라 숨길 이유도 없다.
 */
export const SUPABASE_URL = "https://vrfkkfdhpevdkfnagxds.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_flM-Z-3LAE-QeIhKZhL9aw_quisyedm";

/** 피드·검색·글쓰기 API. 웹과 같은 서버를 쓴다. */
export const API_URL = "https://tennisscene.vercel.app";
