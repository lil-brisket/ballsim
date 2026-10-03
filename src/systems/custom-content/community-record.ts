/**
 * Forward-compatible community library record. Unused in the first
 * implementation — packages persist locally via CustomContentPackage.
 */
export type CommunityContentRecord = {
  contentId: string;
  type: "roster" | "draft_class";
  title: string;
  published: boolean;
  downloadCount: number;
  voteCount: number;
};
