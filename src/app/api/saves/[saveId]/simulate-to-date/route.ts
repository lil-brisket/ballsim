import { revalidatePath } from "next/cache";
import { advanceOwnerTime } from "@/application/game-service";
import type { SimulateToDateStreamEvent } from "@/application/simulate-to-date-stream";
import {
  isSimulationInFlight,
  runWithSimulationDedupe,
} from "@/application/simulation-guard";
import {
  clearSimulationStopRequest,
  isSimulationStopRequested,
} from "@/application/simulation-stop-requests";
import { toCalendarLeagueContext } from "@/state/standings-selectors";
import { parseCalendarDate } from "@/domain/calendar-date";
import {
  type CalendarMonthGrid,
  getCalendarMonthGrid,
} from "@/systems/calendar";

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
  // A closed tab must not abort the run: the simulation keeps going and saves,
  // and writes to the dead stream are dropped.
  let clientGone = false;
  let sentGridMonth: string | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SimulateToDateStreamEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          clientGone = true;
        }
      };
      const close = () => {
        if (clientGone) return;
        try {
          controller.close();
        } catch {
          clientGone = true;
        }
      };
      try {
        const result = await runWithSimulationDedupe(saveId, () =>
          advanceOwnerTime(saveId, {
            targetDate,
            skipInProcessDedupe: true,
            shouldStop: () => isSimulationStopRequested(saveId),
            onProgress: (progress, state) => {
              // Send each month's grid once so the calendar keeps showing the
              // schedule after playback leaves the month the page loaded with.
              const month = progress.currentDate.slice(0, 7);
              let monthGrid: CalendarMonthGrid | undefined;
              if (month !== sentGridMonth) {
                sentGridMonth = month;
                const { year, month: monthNumber } = parseCalendarDate(
                  progress.currentDate,
                );
                monthGrid = getCalendarMonthGrid(state, year, monthNumber, {
                  saveId,
                });
              }
              send({
                type: "progress",
                ...progress,
                leagueContext: toCalendarLeagueContext(state),
                monthGrid,
              });
            },
          }).finally(() => clearSimulationStopRequest(saveId)),
        );
        if (!result.ok) {
          send({ type: "error", ok: false, message: result.error });
          close();
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
        close();
      } catch (error) {
        const message = isSimulationInFlight(error)
          ? "Simulation already in progress for this save."
          : error instanceof Error
            ? error.message
            : "Simulation failed.";
        send({ type: "error", ok: false, message });
        close();
      }
    },
    cancel() {
      clientGone = true;
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
