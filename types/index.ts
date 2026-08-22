// Role Types
export interface Role {
  role_id: string;
  role_name: string;
  dashboard: boolean;
  attendance: boolean;
  leave: boolean;
  registration_request: boolean;
  setting: boolean;
  staff: boolean;
  inventory: boolean;
  purchasing: boolean;
  sales_order: boolean;
  delivery_order: boolean;
  report_builder: boolean;
  can_approve: boolean;
  is_super_admin: boolean;
}

// User Types
export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: string;
  role_id: string;
  last_active?: string;
  // Profile fields — editable by the user themselves
  photo_url?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  gender?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  bio?: string;
}

// Profile — subset of User that a user can self-edit
export interface UserProfile {
  name: string;
  photo_url?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  gender?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  bio?: string;
}

// Registration Types
export interface Registration {
  id: string;
  name: string;
  email: string;
  password: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  update_at: string;
}

// Attendance Types
export interface AttendanceImport {
  cloud_id: string;
  id: string;
  employee_name: string;
  attendance_date: string;
  jam_set: string;
  jam_absensi: string;
  verifikasi: string;
  tipe_absensi: string;
  designation: string;
  branch: string;
  remarks: string; // NEW — kolom L di sheet
}

export interface AttendanceRecord {
  id: string;
  employee_name: string;
  designation: string;
  attendance_date: string;
  shift_start: string;
  in_time: string;
  late_entry_minutes: number;
  keterangan_masuk: string;
  shift_end: string;
  out_time: string;
  overtime_minutes: number;
  keterangan_pulang: string;
  remarks: string; // NEW — dari kolom keterangan import
}

export interface AttendanceRecap {
  nama_karyawan: string;
  jumlah_hadir: number;
  jumlah_keterlambatan: number;
  total_keterlambatan_menit: number;
  average_keterlambatan: number;
  jumlah_overtime: number;
  total_overtime_menit: number;
  average_overtime: number;
}

// Leave Types
export interface LeaveAttendance {
  id: string;
  employee: string;
  employee_name: string;
  from_date: string;
  to_date: string;
  leave_type: string;
  attachment: string;
  description: string; // NEW — kolom J di sheet
  created_at: string;
  update_at: string;
}

// Staff Types
export interface StaffList {
  employee_id: string;
  user_id: string;
  employee_name: string;
  date_of_birth?: string;
  leave_allocation?: number;
}

// Session Types
export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: string;
  role_id?: string;
  permissions: {
    dashboard: boolean;
    attendance: boolean;
    leave: boolean;
    registration_request: boolean;
    setting: boolean;
    staff: boolean;
    inventory: boolean;
    purchasing: boolean;
    sales_order: boolean;
    delivery_order: boolean;
    report_builder: boolean;
    can_approve: boolean;
  };
  isSuperAdmin?: boolean;
}

// ── Inventory Module ──────────────────────────────────────────────────────

export type ItemCurrency = 'IDR' | 'USD';
export type ItemType = 'Trading' | 'Regular';

export interface Item {
  item_code: string;
  item_name: string;
  item_group: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  reorder_level: number;
  valuation_method: 'FIFO' | 'Average';
  opening_qty: number;
  opening_valuation_rate: number;
  is_active: boolean;
  currency: ItemCurrency;
  item_type: ItemType;
}

export interface Bom {
  bom_id: string;
  item_code: string;
  item_name?: string;
  qty: number;
  is_active: boolean;
  owner: string;
  creation: string;
  components: BomComponent[];
}

export interface BomComponent {
  bom_id: string;
  component_item_code: string;
  component_item_name?: string;
  qty: number;
}

export interface Warehouse {
  warehouse_id: string;
  warehouse_name: string;
  location: string; // City (searchable picker) — column name kept as "location" for backward compatibility
  is_active: boolean;
  pic: string;
  phone: string;
  address: string;
  postal_code: string;
}

export type StockEntryType = 'Material Receipt' | 'Material Issue' | 'Material Transfer' | 'Manufacture';

export interface StockEntry {
  entry_id: string;
  entry_type: StockEntryType;
  item_code: string;
  source_warehouse: string;
  target_warehouse: string;
  qty: number;
  date: string;
  remarks: string;
  status: string;
  owner: string;
  creation: string;
}

export interface StockLedgerEntry {
  entry_id: string;
  posting_date: string;
  item_code: string;
  warehouse_id: string;
  voucher_type: string;
  voucher_id: string;
  actual_qty: number;
  valuation_rate: number;
  qty_after_transaction: number;
  stock_value: number;
}

export interface StockBalance {
  item_code: string;
  item_name: string;
  warehouse_id: string;
  qty_on_hand: number;
  valuation_rate: number;
  stock_value: number;
  last_transaction_date: string;
}

// ── Purchasing ─────────────────────────────────────────────────────────────

export interface Supplier {
  supplier_id: string;
  supplier_name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  payment_terms: string;
  is_active: boolean;
}

export type DocStatus = 'Draft' | 'Submitted' | 'Partially Received' | 'Received' | 'Cancelled' | 'Closed';

export interface PurchaseOrder {
  po_id: string;
  supplier_id: string;
  supplier_name?: string;
  order_date: string;
  expected_date: string;
  status: DocStatus;
  total_amount: number;
  owner: string;
  creation: string;
  amended_from?: string;
}

export interface PurchaseOrderItem {
  po_id: string;
  item_code: string;
  item_name: string;
  uom: string;
  qty: number;
  rate: number;
  amount: number;
  received_qty: number;
  warehouse_id: string;
}

export interface PurchaseReceipt {
  pr_id: string;
  po_id: string;
  supplier_id: string;
  posting_date: string;
  status: string;
  owner: string;
  creation: string;
}

export interface PurchaseInvoice {
  pi_id: string;
  po_id: string;
  pr_id: string;
  supplier_id: string;
  supplier_name?: string;
  posting_date: string;
  due_date: string;
  grand_total: number;
  outstanding_amount: number;
  status: string;
  owner: string;
  creation: string;
  items?: { item_code: string; item_name: string; uom: string; qty: number; rate: number; amount: number }[];
}

// ── Sales ──────────────────────────────────────────────────────────────────

export interface Customer {
  customer_id: string;
  customer_name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  payment_terms: string;
  credit_limit: number;
  is_active: boolean;
}

export interface SalesOrder {
  so_id: string;
  customer_id: string;
  customer_name?: string;
  order_date: string;
  delivery_date: string;
  status: DocStatus;
  total_amount: number;
  owner: string;
  creation: string;
  amended_from?: string;
}

export interface SalesOrderItem {
  so_id: string;
  item_code: string;
  item_name: string;
  uom: string;
  qty: number;
  rate: number;
  amount: number;
  delivered_qty: number;
  warehouse_id: string;
}

export interface DeliveryNote {
  dn_id: string;
  so_id: string;
  customer_id: string;
  posting_date: string;
  status: string;
  owner: string;
  creation: string;
  amended_from?: string;
}

export interface DeliveryNoteItem {
  dn_id: string;
  so_id: string;
  item_code: string;
  item_name: string;
  uom: string;
  delivered_qty: number;
  warehouse_id: string;
  rate: number;
}

export interface SalesInvoice {
  si_id: string;
  so_id: string;
  dn_id: string;
  customer_id: string;
  customer_name?: string;
  posting_date: string;
  due_date: string;
  grand_total: number;
  outstanding_amount: number;
  status: string;
  owner: string;
  creation: string;
  items?: { item_code: string; item_name: string; uom: string; qty: number; rate: number; amount: number }[];
}

// ── Payment ────────────────────────────────────────────────────────────────

export interface PaymentEntry {
  payment_id: string;
  payment_type: 'Receive' | 'Pay';
  party_type: 'Customer' | 'Supplier';
  party_id: string;
  reference_type: 'Sales Invoice' | 'Purchase Invoice';
  reference_id: string;
  paid_amount: number;
  posting_date: string;
  mode_of_payment: string;
  status: string;
  owner: string;
  creation: string;
}