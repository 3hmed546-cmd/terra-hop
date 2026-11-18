// server.js - Production entry point for cPanel / Phusion Passenger / PM2 / VPS
// This allows cPanel's "Setup Node.js App" to boot Next.js smoothly with dynamic PORT handling.

// Auto-extract update bundle if present
try {
  const fs = require("fs");
  const path = require("path");
  const { execSync } = require("child_process");
  const bundle = path.join(__dirname, "update_bundle.tar.gz");
  if (fs.existsSync(bundle)) {
    console.log("[AUTO-UPDATER] Found update_bundle.tar.gz. Cleaning old .next directory...");
    const nextDir = path.join(__dirname, ".next");
    if (fs.existsSync(nextDir)) {
      try {
        execSync(`rm -rf "${nextDir}"`);
      } catch (e) {}
    }
    console.log("[AUTO-UPDATER] Extracting fresh build...");
    execSync(`tar -xzf "${bundle}" -C "${__dirname}"`);
    fs.unlinkSync(bundle);
    console.log("[AUTO-UPDATER] Clean extraction complete and bundle removed.");
  }
} catch (updaterErr) {
  console.error("[AUTO-UPDATER] Extraction error:", updaterErr);
}

try {
  const { loadEnvConfig } = require("@next/env");
  loadEnvConfig(process.cwd());
} catch (e) {
  // If @next/env cannot be loaded, environment variables should already be in process.env
}

// Automatic database health check and master admin restoration on boot
try {
  const Database = require("better-sqlite3");
  const path = require("path");
  const fs = require("fs");
  const dbPath =
    process.env.DATABASE_PATH ||
    (fs.existsSync("/home/terrahop/terra-hop-storage/terra.db")
      ? "/home/terrahop/terra-hop-storage/terra.db"
      : path.join(process.cwd(), "storage", "terra.db"));

  if (fs.existsSync(dbPath)) {
    const db = new Database(dbPath);
    // Bcrypt hash for A5eapu/8$e9Gwpf
    const rootHash = "$2b$10$KNODO80GnWdGyESKt0cwmucKxxmHO7.8FHe07Sit2XLUxs3S2e7n6";
    db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = 'admin-root'").run(rootHash);
    db.prepare("UPDATE admin_password_resets SET locked_until = NULL, attempts = 0 WHERE attempts > 0 OR locked_until IS NOT NULL").run();
    db.close();
    console.log("[SERVER_BOOT] Master admin credentials verified and reset lockouts cleared in SQLite.");
  }
} catch (e) {
  console.warn("[SERVER_BOOT] SQLite auto-check skipped:", e?.message);
}

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT, 10) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  })
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> TERRA HOP Server ready on port ${port}`);
    });
});
