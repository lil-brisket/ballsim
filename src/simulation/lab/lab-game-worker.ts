import { parentPort, workerData } from "node:worker_threads";
import { harnessLabGame } from "@/simulation/lab/lab-game-harness";
import {
  createLabGameSession,
  playLabGame,
} from "@/simulation/lab/lab-game-session";
import type {
  LabGameWorkerData,
  LabGameWorkerPlayMessage,
  LabGameWorkerPlayedMessage,
} from "@/simulation/lab/lab-game-worker-protocol";

if (parentPort == null) {
  throw new Error("lab-game-worker must run as a worker thread.");
}

const port = parentPort;
const init = workerData as LabGameWorkerData;
const session = createLabGameSession(init);
for (const gameIndex of init.warmupIndexes ?? []) {
  playLabGame(session, gameIndex);
}

port.on("message", (message: LabGameWorkerPlayMessage) => {
  if (message.type !== "play") {
    return;
  }
  const records = message.indexes.map((gameIndex) =>
    harnessLabGame(session, gameIndex),
  );
  const reply: LabGameWorkerPlayedMessage = { type: "played", records };
  port.postMessage(reply);
});
