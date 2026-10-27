import {
  SkeletonPage,
  SkeletonScreen,
  SkeletonTileBoard,
} from "@/components/ui/Skeleton";

export default function TradesLoading() {
  return (
    <SkeletonScreen>
      <SkeletonPage>
        <SkeletonTileBoard compact />
      </SkeletonPage>
    </SkeletonScreen>
  );
}
