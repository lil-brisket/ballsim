import {
  SkeletonBlock,
  SkeletonCards,
  SkeletonScreen,
} from "@/components/ui/Skeleton";

export default function RosterLoading() {
  return (
    <SkeletonScreen>
      <SkeletonBlock className="h-[105px]" />
      <SkeletonBlock className="h-[45px]" />
      <SkeletonBlock className="h-24" />
      <SkeletonBlock className="h-40" />
      <SkeletonCards />
    </SkeletonScreen>
  );
}
