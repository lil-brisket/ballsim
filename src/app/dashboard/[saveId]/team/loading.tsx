import {
  SkeletonCards,
  SkeletonScreen,
  SkeletonTable,
} from "@/components/ui/Skeleton";

export default function TeamLoading() {
  return (
    <SkeletonScreen>
      <SkeletonCards count={3} />
      <SkeletonTable rows={6} />
    </SkeletonScreen>
  );
}
