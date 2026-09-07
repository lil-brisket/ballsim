import type { ReactNode } from "react";
import { RosterNav } from "@/components/roster/RosterNav";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ saveId: string }>;
};

export default async function RosterLayout({ children, params }: LayoutProps) {
  const { saveId } = await params;
  return (
    <div className="space-y-6">
      <RosterNav saveId={saveId} />
      {children}
    </div>
  );
}
