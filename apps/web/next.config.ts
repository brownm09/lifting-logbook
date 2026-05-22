import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained build under .next/standalone for the Docker
  // runner stage to copy. Without this, .next/standalone is never created
  // and the runner-stage COPY fails.
  // https://nextjs.org/docs/app/api-reference/next-config-js/output
  output: "standalone",
};

export default nextConfig;
