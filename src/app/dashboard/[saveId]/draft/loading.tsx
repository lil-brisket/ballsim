import { SkeletonScreen, SkeletonTable } from "@/components/ui/Skeleton";

export default function DraftLoading() {
  return (
    <SkeletonScreen>
      <SkeletonTable rows={10} />
    </SkeletonScreen>
  );
}
