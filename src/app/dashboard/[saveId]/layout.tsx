import { notFound } from "next/navigation";
import { loadOwnerSave } from "@/application/game-service";
import { GameShell } from "@/components/game/GameShell";

type OwnerLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ saveId: string }>;
};

export default async function OwnerLayout({
  children,
  params,
}: OwnerLayoutProps) {
  const { saveId } = await params;
  const loaded = await loadOwnerSave(saveId);
  if (!loaded) {
    notFound();
  }

  const { save, dashboard } = loaded;

  return (
    <GameShell saveId={saveId} saveName={save.name} dashboard={dashboard}>
      {children}
    </GameShell>
  );
}
