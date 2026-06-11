// Skrip sekali-pakai: kosongkan baris data tab Trips & Details, tulis ulang header.
// Tab Users TIDAK disentuh. Jalankan: node scripts/clean-data.js
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

function loadEnv(file) {
  const raw = fs.readFileSync(file, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[m[1]] = val;
  }
  return env;
}

const TRIPS_HEADER = [
  "ID",
  "Nama",
  "Lokasi Asal",
  "Lokasi Tujuan",
  "Tanggal Mulai",
  "Tanggal Selesai",
  "Orang",
  "Dibuat Oleh",
  "Dibuat Pada",
  "Diubah Oleh",
  "Diubah Pada",
];

const DETAILS_HEADER = [
  "ID",
  "Trip ID",
  "Tanggal",
  "Jam Berangkat",
  "Lokasi Asal",
  "Lokasi Tujuan",
  "Estimasi Durasi",
  "Jam Tiba",
  "Catatan",
  "Dibuat Oleh",
  "Dibuat Pada",
  "Diubah Oleh",
  "Diubah Pada",
];

async function main() {
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  const spreadsheetId = env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID tidak ditemukan");

  const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (typeof creds.private_key === "string") {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const tripsTab = env.GOOGLE_SHEET_TRIPS_TAB || "Trips";
  const detailsTab = env.GOOGLE_SHEET_DETAILS_TAB || "Details";

  const targets = [
    { tab: tripsTab, header: TRIPS_HEADER },
    { tab: detailsTab, header: DETAILS_HEADER },
  ];

  for (const { tab, header } of targets) {
    const lastCol = String.fromCharCode(64 + header.length);
    // 1) Kosongkan seluruh isi tab.
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: tab,
    });
    // 2) Tulis ulang baris header.
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1:${lastCol}1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
    console.log(`Tab "${tab}" dibersihkan & header (${header.length} kolom) ditulis ulang.`);
  }

  console.log("Selesai. Tab Users tidak disentuh.");
}

main().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
