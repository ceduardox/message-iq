import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function setStaticAssetHeaders(res: express.Response, filePath: string) {
  const fileName = path.basename(filePath).toLowerCase();

  if (fileName === "manifest.json") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return;
  }

  if (fileName === "favicon.png" || fileName === "icon-512.png" || fileName.startsWith("apple-touch-icon")) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  }
}

export function serveStatic(app: Express) {
  // In production, dist/public is relative to the bundle location
  // Try multiple paths to find the correct one
  let distPath = path.resolve(process.cwd(), "dist", "public");
  
  if (!fs.existsSync(distPath)) {
    // Try relative to __dirname if it exists
    try {
      const altPath = path.resolve(__dirname, "public");
      if (fs.existsSync(altPath)) {
        distPath = altPath;
      }
    } catch (e) {
      // __dirname not available, use cwd path
    }
  }
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      setHeaders: setStaticAssetHeaders,
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
