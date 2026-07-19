# ERP Roadmap — Thoyokem Dashboard

Dokumen ini adalah panduan untuk pengembangan modul ERP lanjutan di atas dashboard
attendance yang sudah berjalan (MVP saat ini). Baca ini saat kamu siap mengerjakan
modul Sales, POS, Stock, Ledger, dll — tidak perlu dikerjakan sekarang.

## Status MVP (sudah berjalan)

Modul yang sudah ada di project ini, sumber data Google Sheets:

- Dashboard (ringkasan)
- Attendance (absensi, rekap keterlambatan/overtime)
- Leave (cuti/izin)
- Registration (approval user baru)
- Staff (data karyawan)
- Settings

Stack: Next.js 14 (App Router), TypeScript, Tailwind, lucide-react, NextAuth,
Google Sheets sebagai database (via `googleapis`).

## Kenapa modul ERP berikutnya butuh pendekatan berbeda

Google Sheets cocok untuk data attendance (volume kecil, append-only, jarang
relasi kompleks). Begitu masuk ke Sales/POS/Stock/Ledger, kamu akan berhadapan
dengan:

- **Relasi antar entitas yang dalam** (Sales Order → Sales Invoice → Payment Entry →
  Journal Entry → GL Entry), sudah terpetakan di `ERPNext_Database_Schema.xlsx`
  sheet **"ERD (Relations)"**.
- **Transaksi yang harus konsisten** (stock berkurang saat invoice dibuat, saldo
  ledger harus balance/double-entry). Google Sheets tidak punya transaction/lock,
  rawan race condition kalau dipakai multi-user.
- **Volume data lebih besar & butuh query relasional** (laporan penjualan per
  periode, kartu stok, buku besar per akun).

**Rekomendasi**: begitu mulai modul Sales/POS/Stock/Ledger, migrasikan storage dari
Google Sheets ke database relasional (Postgres direkomendasikan) dengan Prisma
sebagai ORM. Attendance module boleh tetap di Google Sheets atau ikut dimigrasikan
belakangan — tidak mendesak.

## Referensi skema

File `ERPNext_Database_Schema.xlsx` (sudah kamu pindahkan) berisi:

- **Summary** — daftar 749 tabel ERPNext beserta jumlah kolom
- **All Columns** — detail kolom per tabel (nama, tipe data, nullable, key, default)
- **ERD (Relations)** — 3.040 relasi antar DocType (Link/Table/Dynamic Link),
  ini peta hubungan antar modul yang paling penting untuk didesain ulang skema
  Prisma-nya.

Saat mendesain tabel Prisma untuk sebuah modul, cari nama DocType terkait di sheet
itu (misal "Sales Invoice", "Item", "Stock Ledger Entry") untuk tahu kolom apa saja
yang relevan — **tidak perlu ikut semua kolom ERPNext**, ambil yang memang dipakai
di bisnis kamu saja. ERPNext punya banyak kolom untuk fitur enterprise yang mungkin
tidak kamu butuhkan (multi-currency, multi-company, dsb).

## Urutan modul yang disarankan

Urutkan berdasarkan dependency — modul belakangan butuh data dari modul sebelumnya.

### 1. Master Data (fondasi, wajib duluan)
- **Item** — daftar produk/barang (kode, nama, satuan, kategori, harga jual/beli)
- **Customer** — data pelanggan
- **Supplier** — data pemasok
- **Warehouse** — lokasi gudang (kalau stock lebih dari 1 lokasi)

Estimasi: 1-2 minggu (CRUD sederhana, tidak banyak logic).

### 2. Stock (Inventory)
- **Stock Entry** — mutasi stok (masuk/keluar/transfer antar gudang)
- **Stock Ledger Entry** — kartu stok (read-only, hasil kalkulasi dari Stock Entry)
- Laporan: Stock Balance (saldo stok per item per gudang)

Logic penting: setiap transaksi stock harus menghitung ulang saldo berjalan
(running balance) per item+warehouse. Referensi ERPNext DocType `Stock Ledger Entry`
di sheet ERD untuk lihat field `actual_qty`, `qty_after_transaction`, `valuation_rate`.

Estimasi: 2-3 minggu.

### 3. Sales
- **Sales Order** → **Sales Invoice** → **Payment Entry**
- Terhubung ke Item (baris item di invoice) dan Customer
- Saat Sales Invoice submit → otomatis kurangi Stock (buat Stock Ledger Entry)

Estimasi: 3-4 minggu (termasuk print/PDF invoice).

### 4. POS (Point of Sale)
- UI kasir cepat (search item, scan barcode kalau ada, cart, checkout)
- Secara data model, POS Invoice mirip Sales Invoice tapi dengan flow submit lebih
  cepat (langsung paid, langsung cetak struk)
- Bisa dibangun **setelah** Sales module selesai karena reuse logic invoice+stock

Estimasi: 2-3 minggu (di atas fondasi Sales).

### 5. Purchase (opsional, mirror dari Sales)
- **Purchase Order** → **Purchase Invoice** → **Payment Entry**
- Saat Purchase Invoice submit → tambah Stock

Estimasi: 2-3 minggu (banyak reuse pattern dari Sales).

### 6. Ledger / Accounting (paling kompleks, kerjakan terakhir)
- **Chart of Accounts** — struktur akun (Asset, Liability, Equity, Income, Expense)
- **Journal Entry** — entri manual jurnal umum
- **GL Entry** (General Ledger) — hasil kalkulasi otomatis dari semua transaksi
  (Sales Invoice, Purchase Invoice, Payment Entry semua generate GL Entry)
- Laporan: Buku Besar, Neraca (Balance Sheet), Laba Rugi (Profit & Loss)

Ini modul paling berisiko kalau salah desain — prinsip **double-entry** (debit
harus selalu sama dengan kredit) harus dipegang ketat di level database/transaction,
bukan cuma validasi di UI.

Estimasi: 4-8 minggu (butuh riset akuntansi dasar kalau belum familiar).

## Estimasi total

| Fase | Estimasi (1 developer, part-time realistis) |
|---|---|
| Master Data | 1-2 minggu |
| Stock | 2-3 minggu |
| Sales | 3-4 minggu |
| POS | 2-3 minggu |
| Purchase | 2-3 minggu |
| Ledger/Accounting | 4-8 minggu |
| **Total** | **~4-6 bulan** kalau dikerjakan berurutan, part-time |

Bisa lebih cepat kalau fokus full-time, atau kalau scope disederhanakan (misal
skip multi-warehouse, skip approval workflow berlapis).

## Konvensi teknis yang disarankan (konsisten dengan project ini)

- Struktur folder ikuti pola yang sudah ada: `app/dashboard/<modul>/page.tsx`,
  `app/api/<modul>/route.ts`, `types/index.ts` untuk interface.
- Icon pakai `lucide-react` (sudah terpasang), konsisten dengan modul attendance.
- Untuk modul baru (Stock/Sales/POS/Ledger), tambahkan:
  - `prisma/schema.prisma` — skema database baru
  - `lib/db.ts` — Prisma client singleton
  - Migrasi data lama (attendance) ke Postgres bisa menyusul, tidak wajib di awal.
- Permission per-modul: ikuti pola `SessionUser.permissions` yang sudah ada di
  `types/index.ts` (tambah field baru: `sales`, `pos`, `stock`, `ledger`, dst).

## Cara pakai dokumen ini

Saat kamu siap mulai satu modul, buka `ERPNext_Database_Schema.xlsx` sheet
**ERD (Relations)**, filter `Source DocType` sesuai modul (misal "Sales Invoice"),
lihat field apa saja yang relasi ke DocType lain — itu jadi acuan foreign key di
skema Prisma kamu. Lalu cross-check ke sheet **All Columns** untuk tipe data
kolomnya.
