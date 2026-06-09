import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16201f",
        clinic: "#0f766e",
        coral: "#f9735b"
      }
    }
  },
  plugins: []
};

export default config;
