import type { NextConfig } from "next";
const projectUrl = process.env.SUPABASE_URL;
const config: NextConfig = {
  // Server actions accept credentials; never print their arguments in development.
  logging: { serverFunctions: false },
  experimental: { serverActions: { bodySizeLimit: "22mb" } },
  images: {
    remotePatterns: projectUrl
      ? [
          {
            protocol: "https",
            hostname: new URL(projectUrl).hostname,
            pathname: "/storage/v1/object/public/municipal-media/**",
            search: "",
          },
        ]
      : [],
  },
};
export default config;
