import { SkeletonScreen, SkeletonTable } from "@/components/ui/Skeleton";

export default function FreeAgencyLoading() {
  return (
    <SkeletonScreen>
      <SkeletonTable rows={10} />
    </SkeletonScreen>
  );
}
