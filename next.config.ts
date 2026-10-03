import os from "node:os";
import type { NextConfig } from "next";

function localNetworkHostnames(): string[] {
  const hosts = new Set<string>();
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      const family = String(address.family);
      const ipv4 = family === "IPv4" || family === "4";
      if (!ipv4 || address.internal) continue;
      hosts.add(address.address);
    }
  }
  return [...hosts];
}

const extraDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  allowedDevOrigins: [...localNetworkHostnames(), ...extraDevOrigins],
};

export default nextConfig;
