import {
  SkeletonBlock,
  SkeletonPage,
  SkeletonScreen,
} from "@/components/ui/Skeleton";

export default function PlayerLoading() {
  return (
    <SkeletonScreen>
      <SkeletonBlock className="h-48" />
      <SkeletonPage blocks={2} />
    </SkeletonScreen>
  );
}
