import { NextResponse } from 'next/server';
import { z } from 'zod';

/** Parses `data` against `schema`; returns the typed value or a 400 NextResponse to return as-is. */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Data tidak valid';
    return { success: false, response: NextResponse.json({ error: message }, { status: 400 }) };
  }
  return { success: true, data: result.data };
}

const lineItemSchema = z.object({
  item_code: z.string().min(1, 'item_code wajib diisi'),
  qty: z.coerce.number().positive('qty harus lebih dari 0'),
  rate: z.coerce.number().nonnegative('rate tidak boleh negatif'),
  warehouse_id: z.string().min(1, 'warehouse_id wajib diisi'),
});

export const purchaseOrderCreateSchema = z.object({
  supplier_id: z.string().min(1, 'supplier_id wajib diisi'),
  expected_date: z.string().optional().nullable(),
  items: z.array(lineItemSchema).min(1, 'Minimal 1 item'),
});

export const purchaseOrderActionSchema = z.object({
  po_id: z.string().min(1),
  action: z.enum(['submit', 'cancel', 'amend', 'approve', 'reject', 'receive']),
});

export const salesOrderCreateSchema = z.object({
  customer_id: z.string().min(1, 'customer_id wajib diisi'),
  delivery_date: z.string().optional().nullable(),
  items: z.array(lineItemSchema).min(1, 'Minimal 1 item'),
});

export const salesOrderActionSchema = z.object({
  so_id: z.string().min(1),
  action: z.enum(['submit', 'cancel', 'amend', 'approve', 'reject', 'deliver']),
});

export const deliveryNoteActionSchema = z.object({
  dn_id: z.string().min(1),
  action: z.enum(['confirm_pick', 'complete_pack', 'good_issue', 'cancel', 'amend']),
});

export const stockEntryActionSchema = z.object({
  entry_id: z.string().min(1),
  action: z.enum(['cancel']),
});

export const purchaseInvoiceActionSchema = z.object({
  pi_id: z.string().min(1),
  action: z.enum(['cancel']),
});

export const salesInvoiceActionSchema = z.object({
  si_id: z.string().min(1),
  action: z.enum(['cancel']),
});

export const registrationCreateSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export const attachmentUploadSchema = z.object({
  doctype: z.string().min(1, 'doctype wajib diisi'),
  document_id: z.string().min(1, 'document_id wajib diisi'),
});

// ── Master data: Customer ───────────────────────────────────────────────

export const customerCreateSchema = z.object({
  customer_id: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  credit_limit: z.coerce.number().optional().nullable(),
});

export const customerUpdateSchema = z.object({
  customer_id: z.string().min(1, 'customer_id wajib diisi'),
  customer_name: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  credit_limit: z.coerce.number().optional().nullable(),
  is_active: z.boolean().optional().nullable(),
});

const importRowsSchema = <T extends z.ZodTypeAny>(rowSchema: T) =>
  z.object({ rows: z.array(rowSchema).min(1, 'Minimal 1 baris data') });

// Bulk-import routes validate shape only here (rows is a non-empty array);
// each row's required fields are still checked per-row in the route so one
// bad row is skipped with an error message instead of rejecting the whole batch.
export const bulkRowsSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, 'Tidak ada baris untuk diimport'),
});

export const customerImportRowSchema = z.object({
  customer_id: z.string().optional().nullable(),
  customer_name: z.string().min(1, 'customer_name wajib diisi'),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  credit_limit: z.coerce.number().optional().nullable(),
});

export const customerImportSchema = importRowsSchema(customerImportRowSchema);

// ── Master data: Supplier ───────────────────────────────────────────────

export const supplierCreateSchema = z.object({
  supplier_id: z.string().optional().nullable(),
  supplier_name: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
});

export const supplierUpdateSchema = z.object({
  supplier_id: z.string().min(1, 'supplier_id wajib diisi'),
  supplier_name: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  is_active: z.boolean().optional().nullable(),
});

export const supplierImportRowSchema = z.object({
  supplier_id: z.string().optional().nullable(),
  supplier_name: z.string().min(1, 'supplier_name wajib diisi'),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
});

export const supplierImportSchema = importRowsSchema(supplierImportRowSchema);

// ── Master data: Item ───────────────────────────────────────────────────

export const itemCreateSchema = z.object({
  item_code: z.string().min(1, 'item_code wajib diisi'),
  item_name: z.string().optional().nullable(),
  item_group: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  purchase_price: z.coerce.number().optional().nullable(),
  selling_price: z.coerce.number().optional().nullable(),
  reorder_level: z.coerce.number().optional().nullable(),
  valuation_method: z.enum(['FIFO', 'Average']).optional().nullable(),
  opening_qty: z.coerce.number().optional().nullable(),
  opening_valuation_rate: z.coerce.number().optional().nullable(),
  currency: z.enum(['IDR', 'USD']).optional().nullable(),
  item_type: z.enum(['Trading', 'Regular']).optional().nullable(),
});

export const itemUpdateSchema = z.object({
  item_code: z.string().min(1, 'item_code wajib diisi'),
  item_name: z.string().optional().nullable(),
  item_group: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  purchase_price: z.coerce.number().optional().nullable(),
  selling_price: z.coerce.number().optional().nullable(),
  reorder_level: z.coerce.number().optional().nullable(),
  valuation_method: z.enum(['FIFO', 'Average']).optional().nullable(),
  currency: z.enum(['IDR', 'USD']).optional().nullable(),
  item_type: z.enum(['Trading', 'Regular']).optional().nullable(),
  is_active: z.boolean().optional().nullable(),
});

export const itemImportRowSchema = z.object({
  item_name: z.string().min(1, 'item_name wajib diisi'),
  item_code: z.string().optional().nullable(),
  item_group: z.enum(['Liquid', 'Non-Liquid']).optional().nullable(),
  unit: z.string().optional().nullable(),
  purchase_price: z.coerce.number().optional().nullable(),
  selling_price: z.coerce.number().optional().nullable(),
  reorder_level: z.coerce.number().optional().nullable(),
  opening_qty: z.coerce.number().optional().nullable(),
  opening_valuation_rate: z.coerce.number().optional().nullable(),
  valuation_method: z.enum(['FIFO', 'Average']).optional().nullable(),
  currency: z.enum(['USD', 'IDR']).optional().nullable(),
  item_type: z.enum(['Trading', 'Regular']).optional().nullable(),
});

export const itemImportSchema = importRowsSchema(itemImportRowSchema);

// ── Master data: Warehouse ──────────────────────────────────────────────

export const warehouseCreateSchema = z.object({
  warehouse_name: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  pic: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
});

export const warehouseUpdateSchema = z.object({
  warehouse_id: z.string().min(1, 'warehouse_id wajib diisi'),
  warehouse_name: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  pic: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  is_active: z.boolean().optional().nullable(),
});

export const warehouseImportRowSchema = z.object({
  warehouse_name: z.string().min(1, 'warehouse_name wajib diisi'),
  warehouse_id: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  pic: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
});

export const warehouseImportSchema = importRowsSchema(warehouseImportRowSchema);

// ── HR: Staff / Leave ───────────────────────────────────────────────────

export const staffCreateSchema = z.object({
  user_id: z.string().optional().nullable(),
  employee_name: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  leave_allocation: z.coerce.number().optional().nullable(),
});

export const staffUpdateSchema = z.object({
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  user_id: z.string().optional().nullable(),
  employee_name: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  leave_allocation: z.coerce.number().optional().nullable(),
});

export const leaveCreateSchema = z.object({
  employee: z.string().optional().nullable(),
  employee_name: z.string().optional().nullable(),
  from_date: z.string().optional().nullable(),
  to_date: z.string().optional().nullable(),
  leave_type: z.string().optional().nullable(),
  attachment: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const leaveUpdateSchema = z.object({
  id: z.string().min(1, 'id wajib diisi'),
  from_date: z.string().optional().nullable(),
  to_date: z.string().optional().nullable(),
  leave_type: z.string().optional().nullable(),
  attachment: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

// ── Access control: Roles / Users ───────────────────────────────────────

const permissionFlags = {
  dashboard: z.boolean().optional().nullable(),
  attendance: z.boolean().optional().nullable(),
  leave: z.boolean().optional().nullable(),
  registration_request: z.boolean().optional().nullable(),
  setting: z.boolean().optional().nullable(),
  staff: z.boolean().optional().nullable(),
  inventory: z.boolean().optional().nullable(),
  purchasing: z.boolean().optional().nullable(),
  sales_order: z.boolean().optional().nullable(),
  delivery_order: z.boolean().optional().nullable(),
  report_builder: z.boolean().optional().nullable(),
  can_approve: z.boolean().optional().nullable(),
  is_super_admin: z.boolean().optional().nullable(),
};

export const rolePermissionUpdateSchema = z.object({
  role_id: z.string().min(1, 'role_id wajib diisi'),
  doctype: z.string().min(1, 'doctype wajib diisi'),
  read: z.boolean(),
  create: z.boolean(),
  write: z.boolean(),
  delete: z.boolean(),
  export: z.boolean(),
  import: z.boolean(),
  only_if_owner: z.boolean().optional(),
  restrict_to_assigned: z.boolean().optional(),
  submit: z.boolean().optional(),
  cancel: z.boolean().optional(),
  amend: z.boolean().optional(),
  approve: z.boolean().optional(),
  print: z.boolean().optional(),
});

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1, 'Nama key wajib diisi').max(80, 'Nama key maksimal 80 karakter'),
});

export const fieldPermissionUpdateSchema = z.object({
  role_id: z.string().min(1, 'role_id wajib diisi'),
  doctype: z.string().min(1, 'doctype wajib diisi'),
  field: z.string().min(1, 'field wajib diisi'),
  can_view: z.boolean(),
});

export const roleCreateSchema = z.object({
  role_name: z.string().optional().nullable(),
  ...permissionFlags,
});

export const roleUpdateSchema = z.object({
  role_id: z.string().min(1, 'role_id wajib diisi'),
  role_name: z.string().optional().nullable(),
  ...permissionFlags,
});

export const userUpdateSchema = z.object({
  id: z.string().min(1, 'id wajib diisi'),
  role_id: z.coerce.string().min(1, 'role_id wajib diisi'),
});

// ── Inventory: BOM ───────────────────────────────────────────────────────

export const bomCreateSchema = z.object({
  item_code: z.string().min(1, 'item_code wajib diisi'),
  qty: z.coerce.number().positive().optional().nullable(),
  components: z
    .array(
      z.object({
        component_item_code: z.string().min(1, 'component_item_code wajib diisi'),
        qty: z.coerce.number().positive('qty komponen harus lebih dari 0'),
      })
    )
    .min(1, 'Minimal 1 komponen'),
});

// ── Collaboration: Comments ──────────────────────────────────────────────

export const commentCreateSchema = z.object({
  doctype: z.string().min(1, 'doctype wajib diisi'),
  documentId: z.string().min(1, 'documentId wajib diisi'),
  text: z.string().trim().min(1, 'text wajib diisi'),
});

// ── Finance: Payments / Invoices ────────────────────────────────────────

export const paymentCreateSchema = z.object({
  payment_type: z.enum(['Receive', 'Pay']),
  party_type: z.string().optional().default(''),
  party_id: z.string().optional().default(''),
  reference_type: z.enum(['Sales Invoice', 'Purchase Invoice']),
  reference_id: z.string().min(1, 'reference_id wajib diisi'),
  paid_amount: z.coerce.number().positive('paid_amount harus lebih dari 0'),
  mode_of_payment: z.string().optional().nullable(),
});

export const purchaseInvoiceCreateSchema = z.object({
  po_id: z.string().min(1, 'po_id wajib diisi'),
  due_date: z.string().optional().nullable(),
});

export const salesInvoiceCreateSchema = z.object({
  so_id: z.string().min(1, 'so_id wajib diisi'),
  due_date: z.string().optional().nullable(),
});

// ── Profile / Settings ───────────────────────────────────────────────────

export const profileUpdateSchema = z
  .object({
    name: z.string().optional().nullable(),
    photo_url: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    date_of_birth: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    gender: z.string().optional().nullable(),
    emergency_contact_name: z.string().optional().nullable(),
    emergency_contact_phone: z.string().optional().nullable(),
    bio: z.string().optional().nullable(),
    current_password: z.string().optional().nullable(),
    new_password: z.string().optional().nullable(),
  })
  .refine((data) => !data.new_password || !!data.current_password, {
    message: 'current_password wajib diisi untuk mengganti password',
    path: ['current_password'],
  });

export const settingsUpdateSchema = z.record(z.string(), z.string());

// ── Inventory movement ───────────────────────────────────────────────────

export const stockEntryCreateSchema = z.object({
  entry_type: z.enum(['Material Receipt', 'Material Issue', 'Material Transfer', 'Manufacture']),
  item_code: z.string().min(1, 'item_code wajib diisi'),
  source_warehouse: z.string().optional().nullable(),
  target_warehouse: z.string().optional().nullable(),
  qty: z.coerce.number().positive('qty harus lebih dari 0'),
  remarks: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
});

export const stockReconciliationCreateSchema = z.object({
  source: z.enum(['Delivery Note', 'Purchase Receipt', 'Stock Entry']),
  doc_id: z.string().min(1, 'doc_id wajib diisi'),
  item_code: z.string().min(1, 'item_code wajib diisi'),
  warehouse_id: z.string().min(1, 'warehouse_id wajib diisi'),
  missing_qty: z.coerce.number().refine((v) => v !== 0, 'missing_qty tidak boleh 0'),
});

// ── Attendance import (array body, not an object) ────────────────────────

export const attendanceImportSchema = z.array(
  z.object({
    cloud_id: z.string().optional().nullable(),
    id: z.string().optional().nullable(),
    employee_name: z.string().optional().nullable(),
    attendance_date: z.string().optional().nullable(),
    jam_set: z.string().optional().nullable(),
    jam_absensi: z.string().optional().nullable(),
    verifikasi: z.string().optional().nullable(),
    tipe_absensi: z.string().optional().nullable(),
    designation: z.string().optional().nullable(),
    branch: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
  })
);
