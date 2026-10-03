import type {
  CustomContentPackageInput,
  CustomContentPackageRecord,
  CustomContentPackageType,
  CustomContentStore,
} from "@/persistence/custom-content-store";

export function createMemoryCustomContentStore(): CustomContentStore {
  const rows = new Map<string, CustomContentPackageRecord>();

  return {
    async list(
      type?: CustomContentPackageType,
    ): Promise<CustomContentPackageRecord[]> {
      return [...rows.values()]
        .filter((row) => (type === undefined ? true : row.type === type))
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .map((row) => ({ ...row }));
    },
    async getByContentId(
      contentId: string,
    ): Promise<CustomContentPackageRecord | null> {
      const row = rows.get(contentId);
      return row === undefined ? null : { ...row };
    },
    async upsert(
      input: CustomContentPackageInput,
    ): Promise<CustomContentPackageRecord> {
      const existing = rows.get(input.contentId);
      const now = new Date();
      const row: CustomContentPackageRecord = {
        id: existing?.id ?? crypto.randomUUID(),
        contentId: input.contentId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        author: input.author ?? null,
        formatVersion: input.formatVersion,
        payloadJson: input.payloadJson,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        published: existing?.published ?? false,
        downloadCount: existing?.downloadCount ?? 0,
        voteCount: existing?.voteCount ?? 0,
      };
      rows.set(input.contentId, row);
      return { ...row };
    },
    async delete(contentId: string): Promise<boolean> {
      return rows.delete(contentId);
    },
  };
}
