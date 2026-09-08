import { cn, panelDashedClass } from "@/components/ui/styles";

export function EmptyState(props: {
  message: string;
  title?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        panelDashedClass,
        "px-4 py-8 text-center",
        props.className,
      )}
    >
      {props.title ? (
        <p className="text-sm font-medium text-zinc-300">{props.title}</p>
      ) : null}
      <p
        className={cn(
          "text-sm text-zinc-500",
          props.title && "mt-1",
        )}
      >
        {props.message}
      </p>
      {props.action ? <div className="mt-4">{props.action}</div> : null}
    </div>
  );
}

export function ErrorState(props: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-rose-800/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
    >
      {props.message}
    </p>
  );
}
