import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/LegalPage";
import { CONTACT_EMAIL, EFFECTIVE_DATE, OPERATOR, PURGE_AFTER_DAYS } from "@/lib/legal";

export const metadata: Metadata = { title: "개인정보 처리방침" };

/**
 * 개인정보 처리방침 — 개인정보보호법 제30조, 애플 5.1.1(i).
 *
 * **여기 적은 것은 실제로 그렇게 돼 있어야 한다.** 코드가 바뀌면 이 문서도 같이 본다:
 *   수집 항목  → accounts·posts·likes·reports·blocks 테이블
 *   탈퇴 시 파기 → delete_my_account() (supabase/migrations/20260926000500)
 *   1년 뒤 완전 삭제 → src/lib/jobs/purge.ts
 *   AI 에 개인정보 안 넘김 → src/lib/jobs/aiPosts.ts buildContext
 */
export default function PrivacyPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="개인정보 처리방침">
      <p className="text-ink-2">
        {OPERATOR}(이하 &lsquo;운영자&rsquo;)는 테니스씬(웹·앱, 이하 &lsquo;서비스&rsquo;)을 운영하면서 「개인정보 보호법」에 따라 이용자의
        개인정보를 보호하고 관련 고충을 신속하게 처리하기 위해 이 방침을 둡니다.
      </p>

      <Section title="1. 처리하는 개인정보와 목적">
        <p>회원가입과 서비스 이용을 위해 아래 정보를 처리합니다. 필요한 만큼만 받습니다 — 생년월일, 성별, 전화번호, 실명은 받지 않습니다.</p>
        <ul>
          <li>회원 식별·로그인: 이메일 주소, 비밀번호(암호화해 저장하며 운영자도 원문을 알 수 없습니다)</li>
          <li>프로필: 닉네임, 아이디</li>
          <li>서비스 이용 중 생기는 정보: 쓴 글과 댓글(익명 여부 포함), 좋아요·리포스트, 차단 목록, 신고 내역</li>
          <li>자동으로 생기는 정보: 접속 기록(IP 주소, 접속 시각 등 서버 기록), 로그인 유지를 위한 인증 토큰(이용자 기기에만 저장)</li>
        </ul>
        <p>이 정보는 회원 관리, 글·댓글 게시, 부정 이용 방지와 신고 처리, 문의 응대에만 씁니다. 광고 목적의 행태 정보는 수집하지 않고, 분석·광고 도구를 쓰지 않습니다.</p>
      </Section>

      <Section title="2. 공개된 정보에서 가져오는 선수 정보">
        <p>
          서비스는 동호인 테니스 소식을 전하기 위해 카토(kato.kr)가 누구나 볼 수 있게 공개한 랭킹·대회 결과에서
          선수 이름, 소속 클럽, 부서, 순위·입상 기록을 가져와 보여줍니다. 공개된 부서별 상위권과 대회 시상대(우승·준우승·공동 3위)까지만 다루고,
          전체 선수 명단을 모으지 않습니다.
        </p>
        <p>
          자신의 이름이 서비스에 보이지 않기를 원하는 선수는 {mail} 로 요청해 주세요. 본인 확인 후 지체 없이 그 이름이 들어간 글을 내리고,
          이후 새로 올라가는 글에도 나오지 않게 합니다. 회원이 아니어도 요청할 수 있습니다.
        </p>
      </Section>

      <Section title="3. 보유 기간과 파기">
        <ul>
          <li>회원 정보는 탈퇴할 때까지 보관합니다.</li>
          <li>
            탈퇴하면 로그인 정보(이메일·비밀번호)를 즉시 지우고, 닉네임·아이디를 &lsquo;탈퇴한 사용자&rsquo;로 바꾸며, 쓴 글·댓글·좋아요·차단 목록을
            즉시 서비스에서 내립니다.
          </li>
          <li>
            내린 글과 댓글의 내용, 신고 기록은 신고·분쟁 처리와 부정 이용 방지를 위해 {PURGE_AFTER_DAYS}일 동안 보관한 뒤 완전히 지웁니다.
            이 기간에는 다른 이용자에게 보이지 않습니다.
          </li>
          <li>서버 접속 기록은 호스팅 업체의 보관 기준에 따르며, 운영자가 따로 모으지 않습니다.</li>
          <li>전자적 파일은 복구할 수 없는 방법으로 지웁니다.</li>
        </ul>
      </Section>

      <Section title="4. 제3자 제공">
        <p>이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 따라 수사기관 등이 적법한 절차로 요구하는 경우는 예외입니다.</p>
      </Section>

      <Section title="5. 처리 위탁과 국외 이전">
        <p>서비스를 운영하기 위해 아래 업체에 처리를 맡기며, 이 과정에서 개인정보가 국외에 저장됩니다.</p>
        <ul>
          <li>
            Supabase Inc.(미국) — 회원 인증, 데이터베이스 저장. 저장 위치: 호주(시드니). 이전 항목: 1번의 회원 정보 전부. 서비스를 이용할 때 암호화된
            네트워크로 전송되며, 탈퇴 또는 위탁 계약 종료 시까지 보관합니다. 문의:{" "}
            <a href="https://supabase.com/privacy" className="underline">supabase.com/privacy</a>
          </li>
          <li>
            Vercel Inc.(미국) — 웹 서비스·서버 운영. 처리 위치: 대한민국(서울) 및 전 세계 전송망. 이전 항목: 접속 기록, 서비스 이용 중 오가는 정보.
            문의: <a href="https://vercel.com/legal/privacy-policy" className="underline">vercel.com/legal/privacy-policy</a>
          </li>
        </ul>
        <p>
          국외 이전을 원하지 않으면 회원가입을 하지 않거나 탈퇴할 수 있습니다. 이 경우 글쓰기·댓글·반응 등 회원 기능을 쓸 수 없고, 글 읽기는 가입 없이 할 수 있습니다.
        </p>
        <p>
          서비스의 AI 계정(오늘의 코트·레슨 노트·코트 고민·장비)은 Anthropic의 AI 모델로 글을 쓰지만, 이때 이용자의 개인정보나 선수 이름은 넘기지 않습니다.
          대회 이름·부서·일정 같은 공개 정보만 씁니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리와 행사 방법">
        <ul>
          <li>프로필에서 자신의 정보를 보고, 탈퇴로 삭제를 직접 요청할 수 있습니다.</li>
          <li>열람·정정·삭제·처리 정지를 원하면 {mail} 로 요청할 수 있고, 운영자는 10일 안에 조치하고 결과를 알립니다.</li>
          <li>만 14세 미만은 가입할 수 없습니다.</li>
        </ul>
      </Section>

      <Section title="7. 안전성 확보 조치">
        <ul>
          <li>비밀번호는 복호화할 수 없는 방식으로 암호화해 저장합니다.</li>
          <li>모든 통신은 암호화(HTTPS)합니다.</li>
          <li>데이터베이스는 행 단위 접근 통제를 걸어, 이용자는 자기 정보만 바꿀 수 있습니다.</li>
          <li>익명 글의 작성자는 다른 이용자에게 드러나지 않습니다. 신고 처리를 위해 운영자만 확인할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="8. 쿠키 등 자동 수집 장치">
        <p>광고·추적용 쿠키를 쓰지 않습니다. 로그인 유지를 위한 인증 정보만 이용자 기기의 저장 공간에 둡니다. 로그아웃하면 지워집니다.</p>
      </Section>

      <Section title="9. 개인정보 보호책임자">
        <ul>
          <li>책임자: {OPERATOR}</li>
          <li>연락처: {mail}</li>
        </ul>
        <p>
          개인정보 침해에 대한 신고나 상담이 필요하면 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118), 개인정보분쟁조정위원회(kopico.go.kr,
          1833-6972)에 문의할 수 있습니다.
        </p>
      </Section>

      <Section title="10. 방침의 변경">
        <p>
          이 방침은 {EFFECTIVE_DATE}부터 시행합니다. 내용이 바뀌면 시행 7일 전(이용자에게 불리한 변경은 30일 전)부터 서비스 안에 알립니다.
        </p>
      </Section>
    </LegalPage>
  );
}
