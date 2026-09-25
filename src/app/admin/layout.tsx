import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "관리자",
  // 검색에 걸릴 이유가 없다. 걸려도 권한이 없으면 빈 화면이지만 굳이 알릴 필요도 없다.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
