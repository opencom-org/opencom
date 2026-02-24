import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { writeFileSync, mkdirSync } from "fs";
import widgetPackageJson from "./package.json";

// Plugin to generate demo index.html in dist
const generateDemoHtml = (env: Record<string, string>) => ({
  name: "generate-demo-html",
  closeBundle() {
    // Read env vars for demo initialization
    const convexUrl = env.VITE_CONVEX_URL || "https://your-deployment.convex.cloud";
    const workspaceId = env.VITE_WORKSPACE_ID || "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Opencom Widget Demo</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #333; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; overflow-x: auto; }
    code { font-family: 'Monaco', 'Menlo', monospace; font-size: 14px; }
    .note { background: #fff3cd; border: 1px solid #ffc107; padding: 16px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Opencom Widget Demo</h1>
    <p>The chat widget should appear in the bottom-right corner of this page.</p>

    <h2>Installation</h2>
    <pre><code>&lt;script async src="https://cdn.opencom.dev/widget.js"&gt;&lt;/script&gt;
&lt;script&gt;
  window.OpencomWidget.init({
    convexUrl: 'YOUR_CONVEX_URL',
    workspaceId: 'YOUR_WORKSPACE_ID'
  });
&lt;/script&gt;</code></pre>

    <div class="note">
      <strong>Note:</strong> Replace <code>YOUR_WORKSPACE_ID</code> and <code>YOUR_CONVEX_URL</code> with your actual values from the Opencom dashboard.
    </div>
    <p><em>This local dist preview still loads <code>/opencom-widget.iife.js</code> below for offline testing.</em></p>
  </div>

  <script src="/opencom-widget.iife.js"></script>
  <script>
    // Initialize the widget for demo
    if (window.OpencomWidget) {
      window.OpencomWidget.init({
        convexUrl: '${convexUrl}',
        workspaceId: '${workspaceId}'
      });
    }
  </script>
</body>
</html>`;
    mkdirSync("dist", { recursive: true });
    writeFileSync("dist/index.html", html);
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), generateDemoHtml(env)],
    build: {
      lib: {
        entry: resolve(__dirname, "src/main.tsx"),
        name: "OpencomWidget",
        fileName: "opencom-widget",
        formats: ["iife"],
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          manualChunks: undefined,
        },
      },
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
        },
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      __OPENCOM_WIDGET_VERSION__: JSON.stringify(widgetPackageJson.version),
    },
  };
});
