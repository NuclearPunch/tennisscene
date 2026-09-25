import { redirect } from "next/navigation";

export default function AdminIndex() {
  // 신고 처리가 가장 급하다(애플 1.2 "제때 대응"). 들어오면 신고부터 본다.
  redirect("/admin/reports");
}
