import "server-only";

import { getPrisma } from "@/persistence/prisma";
import type {
  CustomContentPackageInput,
  CustomContentPackageRecord,
  CustomContentPackageType,
  CustomContentStore,
} from "@/persistence/custom-content-store";

function toRecord(row: {
  id: string;
  contentId: string;
  type: string;
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
}): CustomContentPackageRecord {
  return {
    ...row,
    type: row.type as CustomContentPackageType,
  };
}

export const prismaCustomContentStore: CustomContentStore = {
  async list(
    type?: CustomContentPackageType,
  ): Promise<CustomContentPackageRecord[]> {
    const rows = await getPrisma().customContentPackage.findMany({
      where: type === undefined ? undefined : { type },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toRecord);
  },
  async getByContentId(
    contentId: string,
  ): Promise<CustomContentPackageRecord | null> {
    const row = await getPrisma().customContentPackage.findUnique({
      where: { contentId },
    });
    return row === null ? null : toRecord(row);
  },
  async upsert(
    input: CustomContentPackageInput,
  ): Promise<CustomContentPackageRecord> {
    const row = await getPrisma().customContentPackage.upsert({
      where: { contentId: input.contentId },
      create: {
        contentId: input.contentId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        author: input.author ?? null,
        formatVersion: input.formatVersion,
        payloadJson: input.payloadJson,
      },
      update: {
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        author: input.author ?? null,
        formatVersion: input.formatVersion,
        payloadJson: input.payloadJson,
      },
    });
    return toRecord(row);
  },
  async delete(contentId: string): Promise<boolean> {
    try {
      await getPrisma().customContentPackage.delete({
        where: { contentId },
      });
      return true;
    } catch {
      return false;
    }
  },
};
