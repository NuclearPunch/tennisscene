/** 영상 썸네일 자리표시. 실제 유튜브 썸네일이 붙기 전까지 쓴다. */
export function CourtThumb({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-label="경기 영상 미리보기"
    >
      <rect width="320" height="180" fill="#edf2ef" />
      <g stroke="#cbd9d1" strokeWidth="1.4" fill="none">
        <rect x="66" y="16" width="188" height="148" />
        <rect x="84" y="16" width="152" height="148" />
        <rect x="84" y="54" width="152" height="72" />
        <path d="M160 54v72M160 16v6M160 158v6" />
      </g>
      <path d="M66 90h188" stroke="#9fb3a8" strokeWidth="2.6" />
    </svg>
  );
}
