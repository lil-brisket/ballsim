import { SkeletonPage, SkeletonScreen } from "@/components/ui/Skeleton";

export default function FinancesLoading() {
  return (
    <SkeletonScreen>
      <SkeletonPage />
    </SkeletonScreen>
  );
}
