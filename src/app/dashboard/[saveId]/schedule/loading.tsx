import { SkeletonScreen, SkeletonTable } from "@/components/ui/Skeleton";

export default function ScheduleLoading() {
  return (
    <SkeletonScreen>
      <SkeletonTable rows={10} />
    </SkeletonScreen>
  );
}
