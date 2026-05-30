const path = require("node:path");
const fs = require("node:fs/promises");
const express = require("express");
const { buildSchedule, buildScheduleCsv, buildScheduleHtml } = require("./lib/scheduler");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const EXPORT_DIR = path.join(ROOT_DIR, "exports");
const DATA_DIR = path.join(ROOT_DIR, "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

app.use(express.json({ limit: "1mb" }));
app.use("/exports", express.static(EXPORT_DIR));
app.use(express.static(PUBLIC_DIR));

function createFileStamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
    "-",
    String(now.getMilliseconds()).padStart(3, "0")
  ].join("");
}

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(EXPORT_DIR, { recursive: true });

  try {
    await fs.access(HISTORY_FILE);
  } catch {
    await fs.writeFile(HISTORY_FILE, "[]", "utf8");
  }
}

async function readHistory() {
  const raw = await fs.readFile(HISTORY_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeHistory(history) {
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
}

function buildExportBaseName(month) {
  return `beosztas-${month}-${createFileStamp()}`;
}

function sendError(response, error) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const message = statusCode >= 500 ? "A szerver oldalon hiba tortent." : error.message;
  if (statusCode >= 500) {
    console.error(error);
  }
  response.status(statusCode).json({ error: message });
}

app.get("/api/history", async (_request, response) => {
  try {
    const history = await readHistory();
    response.json({ history });
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/generate", async (request, response) => {
  try {
    const schedule = buildSchedule(request.body);
    const createdAt = new Date().toISOString();
    const exportBaseName = buildExportBaseName(schedule.month);
    const exportFileName = `${exportBaseName}.html`;
    const csvExportFileName = `${exportBaseName}.csv`;
    const exportPath = `/exports/${exportFileName}`;
    const csvExportPath = `/exports/${csvExportFileName}`;
    const entry = {
      ...schedule,
      id: `${schedule.month}-${createFileStamp()}`,
      createdAt,
      exportFileName,
      exportPath,
      csvExportFileName,
      csvExportPath
    };

    const exportHtml = buildScheduleHtml(entry);
    const exportCsv = buildScheduleCsv(entry);
    const history = await readHistory();
    history.unshift(entry);

    await Promise.all([
      fs.writeFile(path.join(EXPORT_DIR, exportFileName), exportHtml, "utf8"),
      fs.writeFile(path.join(EXPORT_DIR, csvExportFileName), exportCsv, "utf8"),
      writeHistory(history)
    ]);

    response.status(201).json({ entry });
  } catch (error) {
    sendError(response, error);
  }
});

app.get("*", (_request, response) => {
  response.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

ensureStorage()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Beosztas app fut: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Nem sikerult elinditani az alkalmazast.", error);
    process.exitCode = 1;
  });