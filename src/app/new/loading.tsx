import { LoadingState } from "@/components/game/LoadingState";

export default function NewGameLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <LoadingState message="Loading…" />
    </main>
  );
}
