import type { ReactNode } from "react";
import { StaffCoachingNav } from "@/components/staff-coaching/StaffCoachingNav";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ saveId: string }>;
};

export default async function StaffCoachingLayout({
  children,
  params,
}: LayoutProps) {
  const { saveId } = await params;
  return (
    <div className="space-y-6">
      <StaffCoachingNav saveId={saveId} />
      {children}
    </div>
  );
}
