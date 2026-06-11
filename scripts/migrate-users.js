// Skrip sekali-pakai:
//  1) Kosongkan baris data tab Trips & Details, tulis ulang header.
//  2) Tab Users: tulis header baru (9 kolom) + backfill kolom bAktif & audit
//     untuk user yang sudah ada (default aktif, dibuat oleh dirinya sendiri).
// Jalankan: node scripts/migrate-users.js
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

function nowStamp() {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

const TRIPS_HEADER = [
  "ID", "Nama", "Lokasi Asal", "Lokasi Tujuan", "Tanggal Mulai",
  "Tanggal Selesai", "Orang", "Dibuat Oleh", "Dibuat Pada", "Diubah Oleh", "Diubah Pada",
];
const DETAILS_HEADER = [
  "ID", "Trip ID", "Tanggal", "Jam Berangkat", "Lokasi Asal", "Lokasi Tujuan",
  "Estimasi Durasi", "Jam Tiba", "Catatan", "Dibuat Oleh", "Dibuat Pada", "Diubah Oleh", "Diubah Pada",
];
const USERS_HEADER = [
  "User ID", "Nama", "Nama Lengkap", "Password", "bAktif",
  "Dibuat Oleh", "Dibuat Pada", "Diubah Oleh", "Diubah Pada",
];

const colLetter = (n) => String.fromCharCode(64 + n);

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
  const usersTab = env.GOOGLE_SHEET_USERS_TAB || "Users";

  // --- 1) Kosongkan Trips & Details, tulis header ---
  for (const { tab, header } of [
    { tab: tripsTab, header: TRIPS_HEADER },
    { tab: detailsTab, header: DETAILS_HEADER },
  ]) {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: tab });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1:${colLetter(header.length)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
    console.log(`Tab "${tab}" dikosongkan & header ditulis ulang.`);
  }

  // --- 2) Users: header baru + backfill kolom baru ---
  const stamp = nowStamp();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${usersTab}!A2:I`,
  });
  const rows = (res.data.values ?? []).filter((r) => r && r[0]);
  const rebuilt = rows.map((r) => {
    const id = r[0] ?? "";
    return [
      id,
      r[1] ?? "", // Nama
      r[2] ?? "", // Nama Lengkap
      r[3] ?? "", // Password
      r[4] && String(r[4]).trim() !== "" ? r[4] : "TRUE", // bAktif
      r[5] && String(r[5]).trim() !== "" ? r[5] : id, // Dibuat Oleh
      r[6] && String(r[6]).trim() !== "" ? r[6] : stamp, // Dibuat Pada
      r[7] && String(r[7]).trim() !== "" ? r[7] : id, // Diubah Oleh
      r[8] && String(r[8]).trim() !== "" ? r[8] : stamp, // Diubah Pada
    ];
  });

  // Tulis header.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${usersTab}!A1:I1`,
    valueInputOption: "RAW",
    requestBody: { values: [USERS_HEADER] },
  });
  // Tulis ulang baris data (bila ada).
  if (rebuilt.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${usersTab}!A2:I${rebuilt.length + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: rebuilt },
    });
  }
  console.log(
    `Tab "${usersTab}" header diperbarui (9 kolom), ${rebuilt.length} user di-backfill (default aktif).`
  );

  console.log("Selesai.");
}

main().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
