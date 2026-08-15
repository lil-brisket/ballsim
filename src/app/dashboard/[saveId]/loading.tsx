import { LoadingState } from "@/components/game/LoadingState";

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <LoadingState message="Loading franchise…" />
    </div>
  );
}
