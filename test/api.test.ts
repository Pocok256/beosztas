import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { startServer } from "../server";

type ApiErrorPayload = {
  error: string;
};

type ApiHistoryPayload = {
  history: Array<{ id: string; config?: { sameAssignmentBonus?: number } }>;
};

type ApiConfigPayload = {
  schedulerConfig: {
    sections: unknown[];
    values: {
      sameAssignmentBonus: number;
    };
  };
};

type ApiGeneratePayload = {
  entry: {
    id: string;
    month: string;
    exportPath: string;
    exportFileName: string;
    xlsExportPath: string;
    xlsExportFileName: string;
    config: {
      sameAssignmentBonus: number;
      futureAvailabilityMaxDays: number;
    };
  };
};

type ClosableServer = {
  close: (callback: (error?: Error | null) => void) => void;
};

function stopServer(server: ClosableServer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test("API vegpontok integracios tesztje", async (t) => {
  let serverInfo: Awaited<ReturnType<typeof startServer>> | null = null;
  let baseUrl = "";
  let tempRoot = "";

  t.before(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "beosztas-test-"));
    serverInfo = await startServer({
      host: "127.0.0.1",
      port: 0,
      dataDir: path.join(tempRoot, "data"),
      exportDir: path.join(tempRoot, "exports"),
      publicDir: path.join(process.cwd(), "dist", "public")
    });
    baseUrl = `http://127.0.0.1:${serverInfo.port}`;
  });

  t.after(async () => {
    if (serverInfo?.server) {
      await stopServer(serverInfo.server);
    }

    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  await t.test("GET /api/history visszater az eddigi beosztasokkal", async () => {
    const response = await fetch(`${baseUrl}/api/history`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as ApiHistoryPayload;
    assert.ok(Array.isArray(data.history), "A history mezonek tombnek kell lennie");
  });

  await t.test("GET /api/config visszaadja a scheduler finomhangolo beallitasokat", async () => {
    const response = await fetch(`${baseUrl}/api/config`);
    assert.equal(response.status, 200);

    const data = (await response.json()) as ApiConfigPayload;
    assert.ok(data.schedulerConfig, "A valasz tartalmazza a scheduler konfiguraciot");
    assert.ok(Array.isArray(data.schedulerConfig.sections), "A config szekciok tombkent jonnek vissza");
    assert.ok(data.schedulerConfig.sections.length > 0, "Legalabb egy config szekcio szukseges");
    assert.ok(Number.isFinite(data.schedulerConfig.values.sameAssignmentBonus), "A default ertekek is visszaternek");
  });

  await t.test("POST /api/generate hibat ad hibas bemenet eseten", async () => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-01" })
    });

    assert.equal(response.status, 400);
    const data = (await response.json()) as ApiErrorPayload;
    assert.ok(data.error.includes("legalabb egy embert"), "Megfelelo hibauzenet kell");
  });

  await t.test("POST /api/generate sikeresen general es elmenti a beosztast", async () => {
    const payload = {
      month: "2026-06",
      people: [{ name: "Teszt Elek", unavailableDays: [] }],
      config: {
        sameAssignmentBonus: 77,
        futureAvailabilityMaxDays: 4
      }
    };

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    assert.equal(response.status, 201);
    const data = (await response.json()) as ApiGeneratePayload;
    assert.ok(data.entry, "A valasz tartalmazza a generalt beosztast");
    assert.equal(data.entry.month, "2026-06", "A honap stimmel");
    assert.ok(data.entry.exportPath, "Export utvonal szerepel benne");
    assert.equal(data.entry.config.sameAssignmentBonus, 77, "A felulirt config bekerul az entrybe");
    assert.equal(data.entry.config.futureAvailabilityMaxDays, 4, "A masik config is elmentodik");

    assert.ok(serverInfo, "A tesztszervernek futnia kell.");
    const exportFiles = await fs.readdir(serverInfo.paths.exportDir);
    assert.deepEqual(
      exportFiles.sort(),
      [data.entry.xlsExportFileName, data.entry.exportFileName].sort(),
      "A fajlok a teszt ideiglenes export mappajaba keruljenek"
    );

    const historyPath = path.join(serverInfo.paths.dataDir, "history.json");
    const savedHistory = JSON.parse(await fs.readFile(historyPath, "utf8")) as ApiHistoryPayload["history"];
    assert.equal(savedHistory[0]?.id, data.entry.id, "A history a teszt ideiglenes data mappajaban frissuljon");
    assert.equal(savedHistory[0]?.config?.sameAssignmentBonus, 77, "A history a configot is eltarolja");

    const htmlResponse = await fetch(`${baseUrl}${data.entry.exportPath}`);
    assert.equal(htmlResponse.status, 200);
    assert.match(await htmlResponse.text(), /<title>Beosztas - 2026\. junius<\/title>/);

    const xlsResponse = await fetch(`${baseUrl}${data.entry.xlsExportPath}`);
    assert.equal(xlsResponse.status, 200);
    const xlsText = await xlsResponse.text();
    assert.match(xlsText, /<Worksheet ss:Name="Havi matrix">/);
    assert.match(xlsText, /Teszt Elek/);
    assert.match(xlsText, /Tabla nezetu osszesito/);
    assert.match(xlsText, /<Worksheet ss:Name="Osszesites">/);

    const historyResponse = await fetch(`${baseUrl}/api/history`);
    const historyData = (await historyResponse.json()) as ApiHistoryPayload;
    assert.ok(historyData.history.some((item) => item.id === data.entry.id), "Az uj beosztas szerepel a history-ban");
  });

  await t.test("GET /ismeretlen-utvonal az index fajlt adja vissza", async () => {
    const response = await fetch(`${baseUrl}/ismeretlen-utvonal`);

    assert.equal(response.status, 200);
    assert.match(await response.text(), /<!DOCTYPE html>/i);
  });

  await t.test("GET /api/history generikus hibat ad, ha a history fajl serult", async () => {
    t.mock.method(console, "error", () => {});
    assert.ok(serverInfo, "A tesztszervernek futnia kell.");
    await fs.writeFile(path.join(serverInfo.paths.dataDir, "history.json"), "nem json", "utf8");

    const response = await fetch(`${baseUrl}/api/history`);

    assert.equal(response.status, 500);
    assert.deepEqual((await response.json()) as ApiErrorPayload, { error: "A szerver oldalon hiba tortent." });
  });
});
