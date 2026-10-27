import {
  SkeletonBlock,
  SkeletonPage,
  SkeletonScreen,
} from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <SkeletonScreen>
      <SkeletonPage>
        <SkeletonBlock className="h-96" />
      </SkeletonPage>
    </SkeletonScreen>
  );
}
