/**
 * Generates each portrait in portraits/_work/prompts.jsonl through the OpenAI
 * images API and saves it at its sourcePath, ready for `npm run portraits:ingest`.
 * Skips ids whose source file already exists, so reruns resume. Makes paid API
 * calls (one per missing portrait); needs OPENAI_API_KEY.
 *
 * Usage: npm run portraits:generate
 * Env: PORTRAIT_IMAGE_MODEL, PORTRAIT_IMAGE_SIZE, PORTRAIT_IMAGE_QUALITY
 */

import OpenAI from "openai";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
} from "node:fs";
import path from "node:path";

const client = new OpenAI();

const INPUT = "portraits/_work/prompts.jsonl";
const CONCURRENCY = 2;
const MAX_RETRIES = 4;

interface PortraitJob {
  id: string;
  prompt: string;
  traits: Record<string, number>;
  sourcePath: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readJobs(): PortraitJob[] {
  return readFileSync(INPUT, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function logResult(file: string, job: PortraitJob) {
  mkdirSync("portraits/_work/generation", {
    recursive: true,
  });

  appendFileSync(
    `portraits/_work/generation/${file}`,
    JSON.stringify({
      id: job.id,
      sourcePath: job.sourcePath,
      timestamp: new Date().toISOString(),
    }) + "\n",
  );
}

async function generate(job: PortraitJob) {
  const destination = path.resolve(job.sourcePath);
  const allowedRoot = path.resolve("portraits/_work/source");

  // Prevent writing outside the portrait source directory.
  if (!destination.startsWith(allowedRoot + path.sep)) {
    throw new Error(`Invalid sourcePath: ${job.sourcePath}`);
  }

  if (existsSync(destination)) {
    console.log(`SKIP ${job.id}: already exists`);
    return;
  }

  mkdirSync(path.dirname(destination), {
    recursive: true,
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await client.images.generate({
        model: process.env.PORTRAIT_IMAGE_MODEL ?? "gpt-image-2.5-sunburst",
        prompt: job.prompt,
        size:
          (process.env.PORTRAIT_IMAGE_SIZE as "1024x1024" | "1024x1536") ??
          "1024x1024",
        quality:
          (process.env.PORTRAIT_IMAGE_QUALITY as "low" | "medium" | "high") ??
          "medium",
        output_format: "png",
      });

      const encoded = result.data?.[0]?.b64_json;

      if (!encoded) {
        throw new Error("No image data returned");
      }

      const buffer = Buffer.from(encoded, "base64");

      // Verify PNG signature before saving.
      const pngSignature = "89504e470d0a1a0a";
      if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
        throw new Error("Invalid PNG response");
      }

      writeFileSync(destination, buffer, {
        flag: "wx",
      });

      logResult("completed.jsonl", job);
      console.log(`DONE ${job.id}`);
      return;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(`FAILED ${job.id}`, error);
        logResult("failed.jsonl", job);
        return;
      }

      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`RETRY ${job.id}: attempt ${attempt}: ${reason}`);

      await sleep(2000 * 2 ** (attempt - 1));
    }
  }
}

async function main() {
  const jobs = readJobs();
  let next = 0;

  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await generate(job);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log("Portrait generation finished.");
}

main().catch(console.error);
