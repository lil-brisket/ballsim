import type { TimelinePostView } from "@/state/media-timeline/post-view";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

function ReplyIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}

function RepostIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  );
}

function LikeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 20.5s-8-4.7-8-10.7A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8c0 6-8 10.7-8 10.7z" />
    </svg>
  );
}

/** Display-only counts; not interactive. */
export function TimelineEngagement(props: {
  display: TimelinePostView["engagementDisplay"];
  label: string;
}) {
  const items = [
    { Icon: ReplyIcon, value: props.display.replies },
    { Icon: RepostIcon, value: props.display.reposts },
    { Icon: LikeIcon, value: props.display.likes },
  ];
  return (
    <div
      role="group"
      aria-label={props.label}
      className="flex items-center gap-6 text-sm text-muted"
    >
      {items.map(({ Icon, value }, index) => (
        <span key={index} className="inline-flex items-center gap-1.5">
          <Icon />
          <span aria-hidden="true" className="tabular-nums">
            {value}
          </span>
        </span>
      ))}
    </div>
  );
}
