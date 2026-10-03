import type { SimulateToDateStreamEvent } from "@/application/simulate-to-date-stream";

export async function streamSimulateToDate(
  saveId: string,
  targetDate: string,
  onEvent: (event: SimulateToDateStreamEvent) => void,
): Promise<void> {
  const response = await fetch(`/api/saves/${saveId}/simulate-to-date`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDate }),
  });

  if (!response.ok || response.body == null) {
    let message = "Simulation failed.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (typeof payload.message === "string" && payload.message.length > 0) {
        message = payload.message;
      }
    } catch {
      /* keep default */
    }
    onEvent({ type: "error", ok: false, message });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      onEvent(JSON.parse(line) as SimulateToDateStreamEvent);
    }
    if (done) {
      if (buffer.trim().length > 0) {
        onEvent(JSON.parse(buffer) as SimulateToDateStreamEvent);
      }
      break;
    }
  }
}
