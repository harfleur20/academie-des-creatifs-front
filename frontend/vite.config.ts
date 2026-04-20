import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: "../assets",
  server: {
    host: "0.0.0.0",
    port: 3000,
    open: "http://localhost:3000/",
  },
});
