import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/** Mirrors the League overview: header, snapshot, then two rows of panels. */
export default function LeagueLoading() {
  return (
    <SkeletonScreen className="gap-4">
      <SkeletonBlock className="h-[179px]" />
      <SkeletonBlock className="h-[166px]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-[402px]" />
        <SkeletonBlock className="h-[402px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-[252px]" />
        <SkeletonBlock className="h-[252px]" />
      </div>
    </SkeletonScreen>
  );
}
