/**
 * One-shot builder: merge Natural Earth admin-1 interior lines into a compact
 * GeoJSON file for the franchise map. Run after downloading source files to TEMP.
 */
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";

type LineFeature = {
  type: "Feature";
  properties: { adm0: string };
  geometry: { type: string; coordinates: unknown };
};

const fifty = JSON.parse(
  readFileSync(`${process.env.TEMP}/ne_50m_admin1_lines.geojson`, "utf8"),
) as { features: Array<{ properties: Record<string, unknown>; geometry: LineFeature["geometry"] }> };

const ten = JSON.parse(
  readFileSync(`${process.env.TEMP}/ne_10m_admin1_lines.geojson`, "utf8"),
) as { features: Array<{ properties: Record<string, unknown>; geometry: LineFeature["geometry"] }> };

const extraFrom10m = new Set([
  "MEX",
  "DEU",
  "FRA",
  "ESP",
  "ITA",
  "NGA",
  "ARG",
  "CHL",
  "PER",
  "COL",
  "POL",
  "HUN",
  "ROU",
  "KAZ",
  "PAK",
  "KEN",
  "ETH",
  "BOL",
  "SAU",
  "IRN",
]);

function roundCoords(value: unknown): unknown {
  if (typeof value === "number") {
    return Math.round(value * 1000) / 1000;
  }
  if (Array.isArray(value)) {
    return value.map(roundCoords);
  }
  return value;
}

function compact(
  feature: { properties: Record<string, unknown>; geometry: LineFeature["geometry"] },
): LineFeature {
  return {
    type: "Feature",
    properties: {
      adm0: String(feature.properties.ADM0_A3 ?? ""),
    },
    geometry: {
      type: feature.geometry.type,
      coordinates: roundCoords(feature.geometry.coordinates),
    },
  };
}

const merged: LineFeature[] = fifty.features.map(compact);

for (const feature of ten.features) {
  const adm0 = String(feature.properties.ADM0_A3 ?? "");
  const scale = Number(feature.properties.SCALERANK ?? 99);
  if (!extraFrom10m.has(adm0) || scale > 4) {
    continue;
  }
  merged.push(compact(feature));
}

const collection = {
  type: "FeatureCollection",
  features: merged,
};

const out = "src/data/geo/admin1-lines-50m.json";
writeFileSync(out, JSON.stringify(collection));
console.log(`wrote ${out} features=${merged.length} bytes=${Buffer.byteLength(JSON.stringify(collection))}`);
const by = new Map<string, number>();
for (const feature of merged) {
  by.set(feature.properties.adm0, (by.get(feature.properties.adm0) ?? 0) + 1);
}
console.log(
  [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${code}:${count}`)
    .join(" "),
);
