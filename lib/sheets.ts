import { google, sheets_v4 } from "googleapis";
import { supabase } from "./supabase";

// Tambahkan flag untuk memilih database
const DB_TYPE = process.env.DB_TYPE || "sheets"; // default tetap sheets sampai siap pindah

// ===== Model data =====
// ... (rest of models remains the same)
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
    // Jangan throw error di sini jika sedang menggunakan Supabase
    if (DB_TYPE === "supabase") return null;
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
  if (!creds) {
    throw new Error("Gagal menginisialisasi Google Sheets: Credential tidak ditemukan");
  }
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

async function listTripsSheets(): Promise<Trip[]> {
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

async function listTripsSupabase(): Promise<Trip[]> {
  try {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((t: any) => ({
      id: t.id,
      nama: t.nama,
      lokasiAsal: t.lokasi_asal,
      lokasiTujuan: t.lokasi_tujuan,
      tanggalMulai: t.tanggal_mulai,
      tanggalSelesai: t.tanggal_selesai,
      orang: t.orang || [],
      createdBy: t.created_by,
      createdTime: t.created_at,
      modifiedBy: t.created_by,
      modifiedTime: t.updated_at,
    }));
  } catch (e: any) {
    console.error("Supabase listTrips Error:", e.message);
    throw e;
  }
}

export async function listTrips(): Promise<Trip[]> {
  return DB_TYPE === "supabase" ? listTripsSupabase() : listTripsSheets();
}

// Trip yang boleh dilihat oleh user: dibuat olehnya atau ia diundang.
export async function listTripsForUser(user: SessionUser): Promise<Trip[]> {
  const trips = await listTrips();
  return trips.filter((t) => canAccessTrip(t, user));
}

async function getTripSheets(id: string): Promise<Trip | null> {
  const trips = await listTripsSheets();
  return trips.find((t) => t.id === id) ?? null;
}

async function getTripSupabase(id: string): Promise<Trip | null> {
  try {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return {
      id: data.id,
      nama: data.nama,
      lokasiAsal: data.lokasi_asal,
      lokasiTujuan: data.lokasi_tujuan,
      tanggalMulai: data.tanggal_mulai,
      tanggalSelesai: data.tanggal_selesai,
      orang: data.orang || [],
      createdBy: data.created_by,
      createdTime: data.created_at,
      modifiedBy: data.created_by,
      modifiedTime: data.updated_at,
    };
  } catch (e: any) {
    console.error(`Supabase getTrip Error (${id}):`, e.message);
    throw e;
  }
}

export async function getTrip(id: string): Promise<Trip | null> {
  return DB_TYPE === "supabase" ? getTripSupabase(id) : getTripSheets(id);
}

async function appendTripSheets(
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

async function appendTripSupabase(
  data: TripInput,
  actor: string
): Promise<Trip> {
  try {
    const { data: newTrip, error } = await supabase
      .from("trips")
      .insert([
        {
          nama: data.nama,
          lokasi_asal: data.lokasiAsal,
          lokasi_tujuan: data.lokasiTujuan,
          tanggal_mulai: data.tanggalMulai,
          tanggal_selesai: data.tanggalSelesai,
          orang: data.orang || [],
          created_by: actor,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return {
      id: newTrip.id,
      nama: newTrip.nama,
      lokasiAsal: newTrip.lokasi_asal,
      lokasiTujuan: newTrip.lokasi_tujuan,
      tanggalMulai: newTrip.tanggal_mulai,
      tanggalSelesai: newTrip.tanggal_selesai,
      orang: newTrip.orang || [],
      createdBy: newTrip.created_by,
      createdTime: newTrip.created_at,
      modifiedBy: newTrip.created_by,
      modifiedTime: newTrip.updated_at,
    };
  } catch (e: any) {
    console.error("Supabase appendTrip Error:", e.message);
    throw e;
  }
}

export async function appendTrip(
  data: TripInput,
  actor: string
): Promise<Trip> {
  return DB_TYPE === "supabase"
    ? appendTripSupabase(data, actor)
    : appendTripSheets(data, actor);
}

// Update sebagian field trip (mis. daftar orang). Mengembalikan trip terbaru.
async function updateTripSheets(
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

async function updateTripSupabase(
  id: string,
  patch: TripPatch,
  actor: string
): Promise<Trip | null> {
  try {
    const updateData: any = {};
    if (patch.nama !== undefined) updateData.nama = patch.nama;
    if (patch.lokasiAsal !== undefined) updateData.lokasi_asal = patch.lokasiAsal;
    if (patch.lokasiTujuan !== undefined) updateData.lokasi_tujuan = patch.lokasiTujuan;
    if (patch.tanggalMulai !== undefined) updateData.tanggal_mulai = patch.tanggalMulai;
    if (patch.tanggalSelesai !== undefined) updateData.tanggal_selesai = patch.tanggalSelesai;
    if (patch.orang !== undefined) updateData.orang = patch.orang;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("trips")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    
    return {
      id: data.id,
      nama: data.nama,
      lokasiAsal: data.lokasi_asal,
      lokasiTujuan: data.lokasi_tujuan,
      tanggalMulai: data.tanggal_mulai,
      tanggalSelesai: data.tanggal_selesai,
      orang: data.orang || [],
      createdBy: data.created_by,
      createdTime: data.created_at,
      modifiedBy: data.created_by,
      modifiedTime: data.updated_at,
    };
  } catch (e: any) {
    console.error(`Supabase updateTrip Error (${id}):`, e.message);
    throw e;
  }
}

export async function updateTrip(
  id: string,
  patch: TripPatch,
  actor: string
): Promise<Trip | null> {
  return DB_TYPE === "supabase"
    ? updateTripSupabase(id, patch, actor)
    : updateTripSheets(id, patch, actor);
}

async function deleteTripSheets(id: string): Promise<boolean> {
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
  await deleteDetailsByTripSheets(id);
  return true;
}

async function deleteTripSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (e: any) {
    console.error(`Supabase deleteTrip Error (${id}):`, e.message);
    throw e;
  }
}

export async function deleteTrip(id: string): Promise<boolean> {
  return DB_TYPE === "supabase" ? deleteTripSupabase(id) : deleteTripSheets(id);
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

async function listUsersSheets(): Promise<User[]> {
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

async function listUsersSupabase(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((u: any) => ({
      id: u.id,
      nama: u.nama,
      namaLengkap: u.nama_lengkap,
      password: u.password,
      aktif: u.aktif,
      createdBy: u.id,
      createdTime: u.created_at,
      modifiedBy: u.id,
      modifiedTime: u.updated_at,
    }));
  } catch (e: any) {
    console.error("Supabase listUsers Error:", e.message);
    return [];
  }
}

export async function listUsers(): Promise<User[]> {
  return DB_TYPE === "supabase" ? listUsersSupabase() : listUsersSheets();
}

async function getUserByIdSheets(id: string): Promise<User | null> {
  const users = await listUsersSheets();
  return users.find((u) => u.id === id) ?? null;
}

async function getUserByIdSupabase(id: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return {
      id: data.id,
      nama: data.nama,
      namaLengkap: data.nama_lengkap,
      password: data.password,
      aktif: data.aktif,
      createdBy: data.id,
      createdTime: data.created_at,
      modifiedBy: data.id,
      modifiedTime: data.updated_at,
    };
  } catch (e: any) {
    console.error(`Supabase getUserById Error (${id}):`, e.message);
    return null;
  }
}

export async function getUserById(id: string): Promise<User | null> {
  return DB_TYPE === "supabase" ? getUserByIdSupabase(id) : getUserByIdSheets(id);
}

// Verifikasi kredensial untuk login. Mengembalikan user tanpa password bila
// cocok DAN akun aktif. Akun non-aktif ditolak.
export async function verifyUser(
  id: string,
  password: string
): Promise<Omit<User, "password"> | null> {
  try {
    const user = await getUserById(id);
    if (!user) {
      console.log(`VerifyUser: User ${id} tidak ditemukan`);
      return null;
    }
    if (user.password !== password) {
      console.log(`VerifyUser: Password salah untuk user ${id}`);
      return null;
    }
    if (!user.aktif) {
      console.log(`VerifyUser: Akun ${id} tidak aktif`);
      return null;
    }
    const { password: _pw, ...rest } = user;
    return rest;
  } catch (e: any) {
    console.error("VerifyUser Error:", e.message);
    return null;
  }
}

// Registrasi user baru. Gagal bila User ID sudah dipakai.
async function appendUserSheets(data: UserInput): Promise<User> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, USERS_TAB, USERS_HEADER);
  const existing = await getUserByIdSheets(data.id);
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

async function appendUserSupabase(data: UserInput): Promise<User> {
  const existing = await getUserByIdSupabase(data.id);
  if (existing) {
    throw new Error("User ID sudah terdaftar");
  }
  try {
    const { data: newUser, error } = await supabase
      .from("users")
      .insert([
        {
          id: data.id,
          nama: data.nama,
          nama_lengkap: data.namaLengkap,
          password: data.password,
          aktif: true,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return {
      id: newUser.id,
      nama: newUser.nama,
      namaLengkap: newUser.nama_lengkap,
      password: newUser.password,
      aktif: newUser.aktif,
      createdBy: newUser.id,
      createdTime: newUser.created_at,
      modifiedBy: newUser.id,
      modifiedTime: newUser.updated_at,
    };
  } catch (e: any) {
    throw new Error(`Supabase Insert Error: ${e.message}`);
  }
}

export async function appendUser(data: UserInput): Promise<User> {
  return DB_TYPE === "supabase" ? appendUserSupabase(data) : appendUserSheets(data);
}

// ===== Notifications =====
// Notifikasi in-app per user. Disimpan di tab "Notifications".
// tipe: "undangan" (kamu diundang) | "anggota_baru" (ada orang baru ikut).
export type Notification = {
  id: string;
  userId: string; // penerima notifikasi (User ID)
  tipe: string;
  pesan: string;
  tripId: string;
  dibaca: boolean; // flag sudah dibaca
  createdBy: string;
  createdTime: string;
};

// Field notifikasi yang dibuat dari luar (id/waktu/dibaca di-set otomatis).
export type NotificationInput = {
  userId: string;
  tipe: string;
  pesan: string;
  tripId: string;
};

const NOTIFS_TAB = process.env.GOOGLE_SHEET_NOTIFS_TAB || "Notifications";

const NOTIFS_HEADER = [
  "ID",
  "User ID",
  "Tipe",
  "Pesan",
  "Trip ID",
  "Dibaca",
  "Dibuat Oleh",
  "Dibuat Pada",
];

function rowToNotification(row: (string | undefined)[]): Notification {
  return {
    id: row[0] ?? "",
    userId: row[1] ?? "",
    tipe: row[2] ?? "",
    pesan: row[3] ?? "",
    tripId: row[4] ?? "",
    dibaca: parseDibaca(row[5]),
    createdBy: row[6] ?? "",
    createdTime: row[7] ?? "",
  };
}

function notificationToRow(n: Notification): string[] {
  return [
    n.id,
    n.userId,
    n.tipe,
    n.pesan,
    n.tripId,
    n.dibaca ? "TRUE" : "FALSE",
    n.createdBy,
    n.createdTime,
  ];
}

// Status dibaca: kosong dianggap belum dibaca. Hanya nilai true eksplisit
// (TRUE / 1 / yes / ya / dibaca) yang dianggap sudah dibaca.
function parseDibaca(raw: string | undefined): boolean {
  if (raw === undefined || raw === null || raw.trim() === "") return false;
  const v = raw.trim().toLowerCase();
  return ["true", "1", "yes", "ya", "dibaca"].includes(v);
}

// Simpan banyak notifikasi sekaligus (mis. undangan + pemberitahuan anggota lama).
async function appendNotificationsSheets(
  items: NotificationInput[],
  actor: string
): Promise<void> {
  if (items.length === 0) return;
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, NOTIFS_TAB, NOTIFS_HEADER);
  const stamp = nowStamp();
  const rows = items.map((it) =>
    notificationToRow({
      id: newId(),
      userId: it.userId,
      tipe: it.tipe,
      pesan: it.pesan,
      tripId: it.tripId,
      dibaca: false,
      createdBy: actor,
      createdTime: stamp,
    })
  );
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${NOTIFS_TAB}!A2:H`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

async function appendNotificationsSupabase(
  items: NotificationInput[]
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase.from("notifications").insert(
    items.map((it) => ({
      user_id: it.userId,
      tipe: it.tipe,
      pesan: it.pesan,
      trip_id: it.tripId === "" ? null : it.tripId,
      dibaca: false,
    }))
  );
  if (error) throw error;
}

export async function appendNotifications(
  items: NotificationInput[],
  actor: string
): Promise<void> {
  return DB_TYPE === "supabase"
    ? appendNotificationsSupabase(items)
    : appendNotificationsSheets(items, actor);
}

// Daftar notifikasi milik user, terbaru di atas.
async function listNotificationsForUserSheets(
  userId: string
): Promise<Notification[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, NOTIFS_TAB, NOTIFS_HEADER);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${NOTIFS_TAB}!A2:H`,
  });
  const rows = res.data.values ?? [];
  const uid = userId.toLowerCase().trim();
  return rows
    .filter((r) => r && r.length > 0 && r[0])
    .map((r) => rowToNotification(r as string[]))
    .filter((n) => n.userId.toLowerCase().trim() === uid)
    .reverse(); // baris terbaru ada di bawah -> tampilkan terbalik
}

async function listNotificationsForUserSupabase(
  userId: string
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((n: any) => ({
    id: n.id,
    userId: n.user_id,
    tipe: n.tipe,
    pesan: n.pesan,
    tripId: n.trip_id || "",
    dibaca: n.dibaca,
    createdBy: "",
    createdTime: n.created_at,
  }));
}

export async function listNotificationsForUser(
  userId: string
): Promise<Notification[]> {
  return DB_TYPE === "supabase"
    ? listNotificationsForUserSupabase(userId)
    : listNotificationsForUserSheets(userId);
}

// Tandai notifikasi milik user sebagai sudah dibaca. Bila `ids` kosong/tak diisi,
// tandai semua notifikasi user. Mengembalikan jumlah yang diperbarui.
async function markNotificationsReadSheets(
  userId: string,
  ids?: string[]
): Promise<number> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, NOTIFS_TAB, NOTIFS_HEADER);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${NOTIFS_TAB}!A2:H`,
  });
  const rows = res.data.values ?? [];
  const uid = userId.toLowerCase().trim();
  const idSet = ids && ids.length > 0 ? new Set(ids) : null;

  const updates: { range: string; values: string[][] }[] = [];
  rows.forEach((r, i) => {
    const id = r[0];
    const rowUser = (r[1] ?? "").toLowerCase().trim();
    if (!id || rowUser !== uid) return;
    if (idSet && !idSet.has(id)) return;
    if (parseDibaca(r[5])) return; // sudah dibaca, lewati
    const rowNumber = i + 2; // header di baris 1
    updates.push({
      range: `${NOTIFS_TAB}!F${rowNumber}`,
      values: [["TRUE"]],
    });
  });

  if (updates.length === 0) return 0;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: updates },
  });
  return updates.length;
}

async function markNotificationsReadSupabase(
  userId: string,
  ids?: string[]
): Promise<number> {
  let query = supabase
    .from("notifications")
    .update({ dibaca: true })
    .eq("user_id", userId)
    .eq("dibaca", false);
  
  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { data, error } = await query.select();
  if (error) throw error;
  return data?.length || 0;
}

export async function markNotificationsRead(
  userId: string,
  ids?: string[]
): Promise<number> {
  return DB_TYPE === "supabase"
    ? markNotificationsReadSupabase(userId, ids)
    : markNotificationsReadSheets(userId, ids);
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

async function listDetailsSheets(tripId?: string): Promise<Detail[]> {
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

async function listDetailsSupabase(tripId?: string): Promise<Detail[]> {
  let query = supabase.from("trip_details").select("*").order("tanggal", { ascending: true });
  if (tripId) {
    query = query.eq("trip_id", tripId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id,
    tripId: d.trip_id,
    tanggal: d.tanggal,
    jamBerangkat: d.jam_berangkat,
    lokasiAsal: d.lokasi_asal,
    lokasiTujuan: d.lokasi_tujuan,
    estimasiDurasi: d.estimasi_durasi,
    jamTiba: d.jam_tiba,
    catatan: d.catatan,
    createdBy: d.created_by,
    createdTime: d.created_at,
    modifiedBy: d.created_by,
    modifiedTime: d.updated_at,
  }));
}

export async function listDetails(tripId?: string): Promise<Detail[]> {
  return DB_TYPE === "supabase" ? listDetailsSupabase(tripId) : listDetailsSheets(tripId);
}

async function appendDetailSheets(
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

async function appendDetailSupabase(
  data: DetailInput,
  actor: string
): Promise<Detail> {
  const { data: newDetail, error } = await supabase
    .from("trip_details")
    .insert([
      {
        trip_id: data.tripId,
        tanggal: data.tanggal,
        jam_berangkat: data.jamBerangkat,
        lokasi_asal: data.lokasiAsal,
        lokasi_tujuan: data.lokasiTujuan,
        estimasi_durasi: data.estimasiDurasi,
        jam_tiba: data.jamTiba,
        catatan: data.catatan,
        created_by: actor,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return {
    id: newDetail.id,
    tripId: newDetail.trip_id,
    tanggal: newDetail.tanggal,
    jamBerangkat: newDetail.jam_berangkat,
    lokasiAsal: newDetail.lokasi_asal,
    lokasiTujuan: newDetail.lokasi_tujuan,
    estimasiDurasi: newDetail.estimasi_durasi,
    jamTiba: newDetail.jam_tiba,
    catatan: newDetail.catatan,
    createdBy: newDetail.created_by,
    createdTime: newDetail.created_at,
    modifiedBy: newDetail.created_by,
    modifiedTime: newDetail.updated_at,
  };
}

export async function appendDetail(
  data: DetailInput,
  actor: string
): Promise<Detail> {
  return DB_TYPE === "supabase"
    ? appendDetailSupabase(data, actor)
    : appendDetailSheets(data, actor);
}

async function deleteDetailSheets(id: string): Promise<boolean> {
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

async function deleteDetailSupabase(id: string): Promise<boolean> {
  const { error } = await supabase.from("trip_details").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function deleteDetail(id: string): Promise<boolean> {
  return DB_TYPE === "supabase" ? deleteDetailSupabase(id) : deleteDetailSheets(id);
}

// Hapus semua detail milik sebuah trip (dipakai saat trip dihapus).
async function deleteDetailsByTripSheets(tripId: string): Promise<void> {
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
