import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/cases", destination: "/dashboard", permanent: false },
      { source: "/cases/new", destination: "/dashboard", permanent: false },
      { source: "/cases/:path*", destination: "/dashboard", permanent: false },
      { source: "/architecture", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
