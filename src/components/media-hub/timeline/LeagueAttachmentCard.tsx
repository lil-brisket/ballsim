import type { LeagueAttachment } from "@/state/media-timeline/types";
import { attachmentSurfaceClass } from "./attachment-parts";

export function LeagueAttachmentCard(props: { attachment: LeagueAttachment }) {
  return (
    <div className={attachmentSurfaceClass}>
      <p className="text-sm text-zinc-400">{props.attachment.summary}</p>
    </div>
  );
}
