import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md and CLAUDE.md are maintained by hand here. Without this,
  // `next dev` regenerates them on every run and overwrites what they say.
  agentRules: false,
};

export default nextConfig;
