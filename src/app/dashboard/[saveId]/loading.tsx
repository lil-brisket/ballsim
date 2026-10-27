import { SkeletonScreen, SkeletonTileBoard } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <SkeletonScreen>
      <SkeletonTileBoard />
    </SkeletonScreen>
  );
}
