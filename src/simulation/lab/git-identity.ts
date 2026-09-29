import { execSync } from "node:child_process";

export type GitIdentity = {
  sha: string | null;
  dirty: boolean;
};

function runGit(command: string): string | null {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Best-effort git identity for a Lab run manifest.
 * Missing git or a failed command yields sha=null and dirty=false.
 */
export function readGitIdentity(): GitIdentity {
  const sha = runGit("git rev-parse HEAD");
  if (sha == null || sha.length === 0) {
    return { sha: null, dirty: false };
  }
  const status = runGit("git status --porcelain");
  return {
    sha,
    dirty: status != null && status.length > 0,
  };
}
