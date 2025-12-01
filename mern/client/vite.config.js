/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/record": "http://localhost:5050",
      "/feed": "http://localhost5050",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/tests/setupTests.js",  
  },
});
