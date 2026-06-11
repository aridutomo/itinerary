import { google, sheets_v4 } from "googleapis";

// ===== Model data =====
// Trip (Rencana): perjalanan utama — dari mana ke mana, tanggal mulai s/d selesai,
// dan daftar orang yang ikut.
export type Trip = {
  id: string;
  nama: string;
  lokasiAsal: string;
  lokasiTujuan: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  orang: string[];
  createdBy: string;
  createdTime: string;
  modifiedBy: string;
  modifiedTime: string;
};

// Field trip yang boleh dibuat/diubah dari luar (audit di-set otomatis).
export type TripInput = {
  id?: string;
  nama: string;
  lokasiAsal: string;
  lokasiTujuan: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  orang: string[];
};

export type TripPatch = Partial<
  Pick<
    Trip,
    | "nama"
    | "lokasiAsal"
    | "lokasiTujuan"
    | "tanggalMulai"
    | "tanggalSelesai"
    | "orang"
  >
>;

// User yang sedang login — dipakai untuk audit & filter akses.
export type SessionUser = { id: string; name?: string | null };

// User: akun untuk registrasi & login. Disimpan di tab "Users".
export type User = {
  id: string; // User ID (dipakai untuk login)
  nama: string; // Nama panggilan / tampilan
  namaLengkap: string; // Nama lengkap
  password: string;
  aktif: boolean; // bAktif: akun aktif boleh login & diundang
  createdBy: string;
  createdTime: string;
  modifiedBy: string;
  modifiedTime: string;
};

// Field user yang diisi saat registrasi (audit & status di-set otomatis).
export type UserInput = {
  id: string;
  nama: string;
  namaLengkap: string;
  password: string;
};

// Detail (Tujuan): tempat-tempat yang ingin dikunjungi di dalam sebuah Trip.
export type Detail = {
  id: string;
  tripId: string;
  tanggal: string;
  jamBerangkat: string;
  lokasiAsal: string;
  lokasiTujuan: string;
  estimasiDurasi: string;
  jamTiba: string;
  catatan: string;
  createdBy: string;
  createdTime: string;
  modifiedBy: string;
  modifiedTime: string;
};

// Field detail yang boleh dibuat dari luar (audit di-set otomatis).
export type DetailInput = {
  id?: string;
  tripId: string;
  tanggal: string;
  jamBerangkat: string;
  lokasiAsal: string;
  lokasiTujuan: string;
  estimasiDurasi: string;
  jamTiba: string;
  catatan: string;
};

const TRIPS_TAB = process.env.GOOGLE_SHEET_TRIPS_TAB || "Trips";
const DETAILS_TAB = process.env.GOOGLE_SHEET_DETAILS_TAB || "Details";
const USERS_TAB = process.env.GOOGLE_SHEET_USERS_TAB || "Users";

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

const USERS_HEADER = [
  "User ID",
  "Nama",
  "Nama Lengkap",
  "Password",
  "bAktif",
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

function getServiceAccountCreds() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env tidak ditemukan");
  }
  try {
    const creds = JSON.parse(raw);
    if (typeof creds.private_key === "string") {
      creds.private_key = creds.private_key.replace(/\\n/g, "\n");
    }
    return creds;
  } catch (e) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON bukan JSON yang valid");
  }
}

let cachedClient: sheets_v4.Sheets | null = null;

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (cachedClient) return cachedClient;
  const creds = getServiceAccountCreds();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID env tidak ditemukan");
  return id;
}

// Pastikan tab ada (dibuat bila belum) lalu pastikan baris header terisi.
async function ensureTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: string,
  header: string[]
) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tab);
  if (!exists) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tab } } }],
        },
      });
    } catch (e) {
      // Race condition: request lain mungkin sudah membuat tab ini di antara
      // pembacaan metadata dan pembuatan. Abaikan bila tab memang sudah ada.
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("already exists")) throw e;
    }
  }
  const lastCol = String.fromCharCode(64 + header.length); // 7 -> "G", 9 -> "I"
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:${lastCol}1`,
  });
  const row = res.data.values?.[0] ?? [];
  if (row.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1:${lastCol}1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
  }
}

async function getSheetId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: string
): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
  const sheetId = sheet?.properties?.sheetId;
  return sheetId === undefined || sheetId === null ? null : sheetId;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Stempel waktu audit dalam waktu lokal WIB, format "dd/mm/yyyy HH:MM:SS"
// (mis. 11/06/2026 14:30:00). Mudah dibaca langsung di Google Sheet.
function nowStamp(): string {
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
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get(
    "minute"
  )}:${get("second")}`;
}

// ===== Serialisasi orang =====
function parseOrang(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function serializeOrang(orang: string[]): string {
  return orang.map((s) => s.trim()).filter(Boolean).join(", ");
}

// ===== Trips =====
function rowToTrip(row: (string | undefined)[]): Trip {
  return {
    id: row[0] ?? "",
    nama: row[1] ?? "",
    lokasiAsal: row[2] ?? "",
    lokasiTujuan: row[3] ?? "",
    tanggalMulai: row[4] ?? "",
    tanggalSelesai: row[5] ?? "",
    orang: parseOrang(row[6]),
    createdBy: row[7] ?? "",
    createdTime: row[8] ?? "",
    modifiedBy: row[9] ?? "",
    modifiedTime: row[10] ?? "",
  };
}

function tripToRow(t: Trip): string[] {
  return [
    t.id,
    t.nama,
    t.lokasiAsal,
    t.lokasiTujuan,
    t.tanggalMulai,
    t.tanggalSelesai,
    serializeOrang(t.orang),
    t.createdBy,
    t.createdTime,
    t.modifiedBy,
    t.modifiedTime,
  ];
}

// ===== Akses & visibilitas =====
// Cocokkan user (berdasarkan id atau nama tampilan) dengan daftar orang yang diundang.
function userMatchesOrang(user: SessionUser, orang: string[]): boolean {
  const tokens = [user.id, user.name]
    .filter((v): v is string => !!v && v.trim() !== "")
    .map((v) => v.toLowerCase().trim());
  return orang.some((o) => tokens.includes(o.toLowerCase().trim()));
}

// Sebuah trip hanya boleh dilihat oleh pembuatnya atau orang yang diundang.
export function canAccessTrip(trip: Trip, user: SessionUser): boolean {
  if (!trip.createdBy) return true; // data lama tanpa pemilik: tetap terlihat
  if (trip.createdBy === user.id) return true;
  return userMatchesOrang(user, trip.orang);
}

export async function listTrips(): Promise<Trip[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, TRIPS_TAB, TRIPS_HEADER);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TRIPS_TAB}!A2:K`,
  });
  const rows = res.data.values ?? [];
  return rows
    .filter((r) => r && r.length > 0 && r[0])
    .map((r) => rowToTrip(r as string[]));
}

// Trip yang boleh dilihat oleh user: dibuat olehnya atau ia diundang.
export async function listTripsForUser(user: SessionUser): Promise<Trip[]> {
  const trips = await listTrips();
  return trips.filter((t) => canAccessTrip(t, user));
}

export async function getTrip(id: string): Promise<Trip | null> {
  const trips = await listTrips();
  return trips.find((t) => t.id === id) ?? null;
}

export async function appendTrip(
  data: TripInput,
  actor: string
): Promise<Trip> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, TRIPS_TAB, TRIPS_HEADER);
  const stamp = nowStamp();
  const trip: Trip = {
    id: data.id || newId(),
    nama: data.nama,
    lokasiAsal: data.lokasiAsal,
    lokasiTujuan: data.lokasiTujuan,
    tanggalMulai: data.tanggalMulai,
    tanggalSelesai: data.tanggalSelesai,
    orang: data.orang ?? [],
    createdBy: actor,
    createdTime: stamp,
    modifiedBy: actor,
    modifiedTime: stamp,
  };
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TRIPS_TAB}!A2:K`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [tripToRow(trip)] },
  });
  return trip;
}

// Update sebagian field trip (mis. daftar orang). Mengembalikan trip terbaru.
export async function updateTrip(
  id: string,
  patch: TripPatch,
  actor: string
): Promise<Trip | null> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, TRIPS_TAB, TRIPS_HEADER);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TRIPS_TAB}!A2:K`,
  });
  const rows = res.data.values ?? [];
  const idx = rows.findIndex((r) => r[0] === id);
  if (idx === -1) return null;
  const current = rowToTrip(rows[idx] as string[]);
  const updated: Trip = {
    ...current,
    ...patch,
    id,
    modifiedBy: actor,
    modifiedTime: nowStamp(),
  };
  const rowNumber = idx + 2; // header di baris 1
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TRIPS_TAB}!A${rowNumber}:K${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [tripToRow(updated)] },
  });
  return updated;
}

export async function deleteTrip(id: string): Promise<boolean> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TRIPS_TAB}!A2:A`,
  });
  const ids = (res.data.values ?? []).map((r) => r[0]);
  const idx = ids.findIndex((v) => v === id);
  if (idx === -1) return false;

  const sheetId = await getSheetId(sheets, spreadsheetId, TRIPS_TAB);
  if (sheetId === null) return false;

  const rowIndex = idx + 1; // A2:A mulai baris 2; idx 0 -> baris 2 (0-indexed: 1)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  // Hapus juga semua detail milik trip ini.
  await deleteDetailsByTrip(id);
  return true;
}

// ===== Users =====
// bAktif: kosong dianggap aktif (data lama). Hanya nilai non-aktif eksplisit
// (FALSE / 0 / no / tidak / nonaktif) yang dianggap tidak aktif.
function parseAktif(raw: string | undefined): boolean {
  if (raw === undefined || raw === null || raw.trim() === "") return true;
  const v = raw.trim().toLowerCase();
  return !["false", "0", "no", "tidak", "nonaktif", "non-aktif"].includes(v);
}

function rowToUser(row: (string | undefined)[]): User {
  return {
    id: row[0] ?? "",
    nama: row[1] ?? "",
    namaLengkap: row[2] ?? "",
    password: row[3] ?? "",
    aktif: parseAktif(row[4]),
    createdBy: row[5] ?? "",
    createdTime: row[6] ?? "",
    modifiedBy: row[7] ?? "",
    modifiedTime: row[8] ?? "",
  };
}

function userToRow(u: User): string[] {
  return [
    u.id,
    u.nama,
    u.namaLengkap,
    u.password,
    u.aktif ? "TRUE" : "FALSE",
    u.createdBy,
    u.createdTime,
    u.modifiedBy,
    u.modifiedTime,
  ];
}

export async function listUsers(): Promise<User[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, USERS_TAB, USERS_HEADER);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${USERS_TAB}!A2:I`,
  });
  const rows = res.data.values ?? [];
  return rows
    .filter((r) => r && r.length > 0 && r[0])
    .map((r) => rowToUser(r as string[]));
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await listUsers();
  return users.find((u) => u.id === id) ?? null;
}

// Verifikasi kredensial untuk login. Mengembalikan user tanpa password bila
// cocok DAN akun aktif. Akun non-aktif ditolak.
export async function verifyUser(
  id: string,
  password: string
): Promise<Omit<User, "password"> | null> {
  const user = await getUserById(id);
  if (!user || user.password !== password || !user.aktif) return null;
  const { password: _pw, ...rest } = user;
  return rest;
}

// Registrasi user baru. Gagal bila User ID sudah dipakai.
export async function appendUser(data: UserInput): Promise<User> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, USERS_TAB, USERS_HEADER);
  const existing = await getUserById(data.id);
  if (existing) {
    throw new Error("User ID sudah terdaftar");
  }
  const stamp = nowStamp();
  const user: User = {
    id: data.id,
    nama: data.nama,
    namaLengkap: data.namaLengkap,
    password: data.password,
    aktif: true,
    createdBy: data.id, // registrasi mandiri: dibuat oleh dirinya sendiri
    createdTime: stamp,
    modifiedBy: data.id,
    modifiedTime: stamp,
  };
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${USERS_TAB}!A2:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [userToRow(user)] },
  });
  return user;
}

// ===== Details =====
function rowToDetail(row: (string | undefined)[]): Detail {
  return {
    id: row[0] ?? "",
    tripId: row[1] ?? "",
    tanggal: row[2] ?? "",
    jamBerangkat: row[3] ?? "",
    lokasiAsal: row[4] ?? "",
    lokasiTujuan: row[5] ?? "",
    estimasiDurasi: row[6] ?? "",
    jamTiba: row[7] ?? "",
    catatan: row[8] ?? "",
    createdBy: row[9] ?? "",
    createdTime: row[10] ?? "",
    modifiedBy: row[11] ?? "",
    modifiedTime: row[12] ?? "",
  };
}

function detailToRow(d: Detail): string[] {
  return [
    d.id,
    d.tripId,
    d.tanggal,
    d.jamBerangkat,
    d.lokasiAsal,
    d.lokasiTujuan,
    d.estimasiDurasi,
    d.jamTiba,
    d.catatan,
    d.createdBy,
    d.createdTime,
    d.modifiedBy,
    d.modifiedTime,
  ];
}

export async function listDetails(tripId?: string): Promise<Detail[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, DETAILS_TAB, DETAILS_HEADER);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${DETAILS_TAB}!A2:M`,
  });
  const rows = res.data.values ?? [];
  let items = rows
    .filter((r) => r && r.length > 0 && r[0])
    .map((r) => rowToDetail(r as string[]));
  if (tripId) items = items.filter((d) => d.tripId === tripId);
  return items;
}

export async function appendDetail(
  data: DetailInput,
  actor: string
): Promise<Detail> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, DETAILS_TAB, DETAILS_HEADER);
  const stamp = nowStamp();
  const item: Detail = {
    id: data.id || newId(),
    tripId: data.tripId,
    tanggal: data.tanggal,
    jamBerangkat: data.jamBerangkat,
    lokasiAsal: data.lokasiAsal,
    lokasiTujuan: data.lokasiTujuan,
    estimasiDurasi: data.estimasiDurasi,
    jamTiba: data.jamTiba,
    catatan: data.catatan,
    createdBy: actor,
    createdTime: stamp,
    modifiedBy: actor,
    modifiedTime: stamp,
  };
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${DETAILS_TAB}!A2:M`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [detailToRow(item)] },
  });
  return item;
}

export async function deleteDetail(id: string): Promise<boolean> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${DETAILS_TAB}!A2:A`,
  });
  const ids = (res.data.values ?? []).map((r) => r[0]);
  const idx = ids.findIndex((v) => v === id);
  if (idx === -1) return false;

  const sheetId = await getSheetId(sheets, spreadsheetId, DETAILS_TAB);
  if (sheetId === null) return false;

  const rowIndex = idx + 1;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
  return true;
}

// Hapus semua detail milik sebuah trip (dipakai saat trip dihapus).
async function deleteDetailsByTrip(tripId: string): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${DETAILS_TAB}!A2:B`,
  });
  const rows = res.data.values ?? [];
  // Kumpulkan index baris (0-indexed dari baris 2) yang tripId-nya cocok.
  const toDelete: number[] = [];
  rows.forEach((r, i) => {
    if (r[1] === tripId) toDelete.push(i + 1); // +1: baris 2 -> index 1
  });
  if (toDelete.length === 0) return;

  const sheetId = await getSheetId(sheets, spreadsheetId, DETAILS_TAB);
  if (sheetId === null) return;

  // Hapus dari bawah ke atas agar index tidak bergeser.
  const requests = toDelete
    .sort((a, b) => b - a)
    .map((rowIndex) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS" as const,
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }));
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}
