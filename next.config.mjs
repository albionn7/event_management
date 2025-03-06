/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
        port: "",
        pathname: "/**", // Allow all paths under utfs.io
      },
    ],
  },
};

export default nextConfig;
