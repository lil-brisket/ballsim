import { revalidatePath } from "next/cache";
import { advanceOwnerTime } from "@/application/game-service";
import type { SimulateToDateStreamEvent } from "@/application/simulate-to-date-stream";
import {
  isSimulationInFlight,
  runWithSimulationDedupe,
} from "@/application/simulation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ saveId: string }> },
): Promise<Response> {
  const { saveId } = await context.params;
  let targetDate = "";
  try {
    const body = (await request.json()) as { targetDate?: unknown };
    targetDate = typeof body.targetDate === "string" ? body.targetDate : "";
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return Response.json({ message: "Invalid target date." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SimulateToDateStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const result = await runWithSimulationDedupe(saveId, () =>
          advanceOwnerTime(saveId, {
            targetDate,
            skipInProcessDedupe: true,
            onProgress: (progress) => {
              send({ type: "progress", ...progress });
            },
          }),
        );
        if (!result.ok) {
          send({ type: "error", ok: false, message: result.error });
          controller.close();
          return;
        }
        revalidatePath(`/dashboard/${saveId}`, "layout");
        send({
          type: "done",
          ok: true,
          daysAdvanced: result.simulation.daysAdvanced,
          highlightCount: result.highlights.length,
          fromDate: result.summary?.fromDate ?? targetDate,
          toDate: result.summary?.toDate ?? result.simulation.currentDate,
          currentDate: result.simulation.currentDate,
          requestedTargetDate: targetDate,
          stopReason: result.simulation.stopReason,
        });
        controller.close();
      } catch (error) {
        const message = isSimulationInFlight(error)
          ? "Simulation already in progress for this save."
          : error instanceof Error
            ? error.message
            : "Simulation failed.";
        send({ type: "error", ok: false, message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
