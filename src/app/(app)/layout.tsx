import { AppHeader } from "@/components/AppHeader";
import { ReactionShell } from "@/components/ReactionShell";
import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-hairline sm:border-x">
      <AppHeader />
      <ReactionShell>
        <main className="grow pb-28">{children}</main>
      </ReactionShell>
      <TabBar />
    </div>
  );
}
