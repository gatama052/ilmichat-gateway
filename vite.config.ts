import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const rootDir = __dirname;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
      react: path.resolve(rootDir, "./node_modules/react"),
      "react-dom": path.resolve(rootDir, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(rootDir, "./node_modules/react/jsx-runtime.js"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
