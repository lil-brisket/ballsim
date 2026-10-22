import Link from "next/link";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import { mediaPageHref } from "@/state/media-timeline/page-view";

export type TextPart =
  | { type: "text"; text: string }
  | { type: "hashtag"; text: string; word: string };

const HASHTAG = /#([A-Za-z0-9_]+)/g;

/** Split post text into plain runs and `#Word` tokens. Pure. */
export function splitHashtags(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(HASHTAG)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ type: "text", text: text.slice(last, index) });
    }
    parts.push({ type: "hashtag", text: match[0], word: match[1]! });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

/** Post body: hashtags in `tags` link to the tag filter; others stay plain ink text. */
export function PostText(props: {
  text: string;
  tags: readonly string[];
  saveId: string;
}) {
  return (
    <>
      {splitHashtags(props.text).map((part, index) => {
        if (part.type === "text") return part.text;
        if (props.tags.includes(part.word)) {
          return (
            <Link
              key={index}
              href={mediaPageHref(props.saveId, { tag: part.word })}
              className={cn(linkClass, "rounded-sm", focusRingClass)}
            >
              {part.text}
            </Link>
          );
        }
        return (
          <span key={index} className="text-team-ink">
            {part.text}
          </span>
        );
      })}
    </>
  );
}
