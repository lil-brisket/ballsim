export type CustomContentPackageType = "roster" | "draft_class";

export type CustomContentPackageRecord = {
  id: string;
  contentId: string;
  type: CustomContentPackageType;
  title: string;
  description: string | null;
  author: string | null;
  formatVersion: number;
  payloadJson: string;
  createdAt: Date;
  updatedAt: Date;
  published: boolean;
  downloadCount: number;
  voteCount: number;
};

export type CustomContentPackageInput = {
  contentId: string;
  type: CustomContentPackageType;
  title: string;
  description?: string | null;
  author?: string | null;
  formatVersion: number;
  payloadJson: string;
};

export type CustomContentStore = {
  list(type?: CustomContentPackageType): Promise<CustomContentPackageRecord[]>;
  getByContentId(contentId: string): Promise<CustomContentPackageRecord | null>;
  upsert(input: CustomContentPackageInput): Promise<CustomContentPackageRecord>;
  delete(contentId: string): Promise<boolean>;
};
