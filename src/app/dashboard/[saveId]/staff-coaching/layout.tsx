import type { ReactNode } from "react";
import { StaffCoachingViews } from "@/components/staff-coaching/StaffCoachingViews";

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
      <StaffCoachingViews saveId={saveId} />
      {children}
    </div>
  );
}
