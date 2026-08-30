#!/usr/bin/env node
// ============================================================
// data/lives/ 配下を再帰的に走査して data/manifest.json を再生成するスクリプト。
// ビルドツールではなく、公演を追加/更新したときにローカルで一度叩く
// 補助スクリプト（デプロイに含める必要はない）。
//
// ファイルは data/lives/{tourId}/{venueId}.json という配置を想定しているが
// （ツアー数が増えてもdata/lives直下がフラットに膨れないようにするため）、
// tourId/venueIdは各JSONファイル自身の中身から読むので、実際のフォルダ名や
// 階層構造には依存しない（サブフォルダを掘っていてもフラットに置いていても動く）。
//
// 使い方:
//   node scripts/generate-manifest.js
//
// tourName / shortName / logo / year など「ライブJSONに無いツアー単位の
// メタデータ」は、既存の manifest.json に載っている値をできる限り引き継ぐ。
// 新しい tourId の場合は tourName をそのまま使い、shortName/logo は空にする
// ので、生成後に手直ししてください。
// ============================================================

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LIVES_DIR = path.join(ROOT, "data", "lives");
const MANIFEST_PATH = path.join(ROOT, "data", "manifest.json");

function loadExistingManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { tours: [] };
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  } catch (e) {
    console.error("既存のmanifest.jsonの読み込みに失敗しました:", e.message);
    return { tours: [] };
  }
}

// data/lives/ 配下の *.json をサブフォルダも含めて再帰的に集める
function findJsonFilesRecursive(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findJsonFilesRecursive(full));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      results.push(full);
    }
  }
  return results;
}

function main() {
  const existing = loadExistingManifest();
  const existingTourById = new Map(existing.tours.map((t) => [t.tourId, t]));

  const files = findJsonFilesRecursive(LIVES_DIR).sort();

  const toursById = new Map();

  for (const full of files) {
    const file = path.relative(LIVES_DIR, full);
    let live;
    try {
      live = JSON.parse(fs.readFileSync(full, "utf-8"));
    } catch (e) {
      console.error(`スキップ: ${file} の読み込みに失敗しました (${e.message})`);
      continue;
    }

    const { tourId, tourName, venueId, venueName, prefecture, date, liveId, setlistStatus } = live;
    if (!tourId || !liveId || !date) {
      console.error(`スキップ: ${file} に tourId/liveId/date のいずれかがありません`);
      continue;
    }

    if (!toursById.has(tourId)) {
      const prev = existingTourById.get(tourId) || {};
      toursById.set(tourId, {
        tourId,
        tourName: tourName || prev.tourName || tourId,
        shortName: prev.shortName || tourName || tourId,
        year: prev.year || parseInt(date.slice(0, 4), 10),
        logo: prev.logo ?? null,
        venues: [],
      });
    }

    toursById.get(tourId).venues.push({
      venueId: venueId || liveId,
      liveId,
      place: venueName || "",
      prefecture: prefecture || "",
      date,
      setlistStatus: setlistStatus || "placeholder",
    });
  }

  const tours = Array.from(toursById.values()).map((t) => ({
    ...t,
    venues: t.venues.sort((a, b) => (a.date < b.date ? -1 : 1)),
  }));

  tours.sort((a, b) => (a.year || 0) - (b.year || 0));

  const manifest = { tours };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`manifest.json を再生成しました（ツアー数: ${tours.length}）`);
}

main();
