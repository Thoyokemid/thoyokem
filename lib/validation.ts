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
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
  credit_limit: z.coerce.number().optional(),
});

export const customerUpdateSchema = z.object({
  customer_id: z.string().min(1, 'customer_id wajib diisi'),
  customer_name: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
  credit_limit: z.coerce.number().optional(),
  is_active: z.boolean().optional(),
});

const importRowsSchema = <T extends z.ZodTypeAny>(rowSchema: T) =>
  z.object({ rows: z.array(rowSchema).min(1, 'Minimal 1 baris data') });

// Bulk-import routes validate shape only here (rows is a non-empty array);
// each row's required fields are still checked per-row in the route so one
// bad row is skipped with an error message instead of rejecting the whole batch.
export const bulkRowsSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, 'Tidak ada baris untuk diimport'),
});

export const customerImportSchema = importRowsSchema(
  z.object({
    customer_id: z.string().optional(),
    customer_name: z.string().min(1, 'customer_name wajib diisi'),
    contact: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    payment_terms: z.string().optional(),
    credit_limit: z.coerce.number().optional(),
  })
);

// ── Master data: Supplier ───────────────────────────────────────────────

export const supplierCreateSchema = z.object({
  supplier_id: z.string().optional(),
  supplier_name: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
});

export const supplierUpdateSchema = z.object({
  supplier_id: z.string().min(1, 'supplier_id wajib diisi'),
  supplier_name: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const supplierImportSchema = importRowsSchema(
  z.object({
    supplier_id: z.string().optional(),
    supplier_name: z.string().min(1, 'supplier_name wajib diisi'),
    contact: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    payment_terms: z.string().optional(),
  })
);

// ── Master data: Item ───────────────────────────────────────────────────

export const itemCreateSchema = z.object({
  item_code: z.string().min(1, 'item_code wajib diisi'),
  item_name: z.string().optional(),
  item_group: z.string().optional(),
  unit: z.string().optional(),
  purchase_price: z.coerce.number().optional(),
  selling_price: z.coerce.number().optional(),
  reorder_level: z.coerce.number().optional(),
  valuation_method: z.enum(['FIFO', 'Average']).optional(),
  opening_qty: z.coerce.number().optional(),
  opening_valuation_rate: z.coerce.number().optional(),
  currency: z.enum(['IDR', 'USD']).optional(),
  item_type: z.enum(['Trading', 'Regular']).optional(),
});

export const itemUpdateSchema = z.object({
  item_code: z.string().min(1, 'item_code wajib diisi'),
  item_name: z.string().optional(),
  item_group: z.string().optional(),
  unit: z.string().optional(),
  purchase_price: z.coerce.number().optional(),
  selling_price: z.coerce.number().optional(),
  reorder_level: z.coerce.number().optional(),
  valuation_method: z.enum(['FIFO', 'Average']).optional(),
  currency: z.enum(['IDR', 'USD']).optional(),
  item_type: z.enum(['Trading', 'Regular']).optional(),
  is_active: z.boolean().optional(),
});

export const itemImportSchema = importRowsSchema(
  z.object({
    item_name: z.string().min(1, 'item_name wajib diisi'),
    item_code: z.string().optional(),
    item_group: z.enum(['Liquid', 'Non-Liquid']).optional(),
    unit: z.string().optional(),
    purchase_price: z.coerce.number().optional(),
    selling_price: z.coerce.number().optional(),
    reorder_level: z.coerce.number().optional(),
    opening_qty: z.coerce.number().optional(),
    opening_valuation_rate: z.coerce.number().optional(),
    valuation_method: z.enum(['FIFO', 'Average']).optional(),
    currency: z.enum(['USD', 'IDR']).optional(),
    item_type: z.enum(['Trading', 'Regular']).optional(),
  })
);

// ── Master data: Warehouse ──────────────────────────────────────────────

export const warehouseCreateSchema = z.object({
  warehouse_name: z.string().optional(),
  location: z.string().optional(),
  pic: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
});

export const warehouseUpdateSchema = z.object({
  warehouse_id: z.string().min(1, 'warehouse_id wajib diisi'),
  warehouse_name: z.string().optional(),
  location: z.string().optional(),
  pic: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const warehouseImportSchema = importRowsSchema(
  z.object({
    warehouse_name: z.string().min(1, 'warehouse_name wajib diisi'),
    warehouse_id: z.string().optional(),
    location: z.string().optional(),
    pic: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    postal_code: z.string().optional(),
  })
);

// ── HR: Staff / Leave ───────────────────────────────────────────────────

export const staffCreateSchema = z.object({
  user_id: z.string().optional(),
  employee_name: z.string().optional(),
  date_of_birth: z.string().optional().nullable(),
  leave_allocation: z.coerce.number().optional(),
});

export const staffUpdateSchema = z.object({
  employee_id: z.string().min(1, 'employee_id wajib diisi'),
  user_id: z.string().optional(),
  employee_name: z.string().optional(),
  date_of_birth: z.string().optional().nullable(),
  leave_allocation: z.coerce.number().optional(),
});

export const leaveCreateSchema = z.object({
  employee: z.string().optional(),
  employee_name: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  leave_type: z.string().optional(),
  attachment: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const leaveUpdateSchema = z.object({
  id: z.string().min(1, 'id wajib diisi'),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  leave_type: z.string().optional(),
  attachment: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

// ── Access control: Roles / Users ───────────────────────────────────────

const permissionFlags = {
  dashboard: z.boolean().optional(),
  attendance: z.boolean().optional(),
  leave: z.boolean().optional(),
  registration_request: z.boolean().optional(),
  setting: z.boolean().optional(),
  staff: z.boolean().optional(),
  inventory: z.boolean().optional(),
  purchasing: z.boolean().optional(),
  sales_order: z.boolean().optional(),
  delivery_order: z.boolean().optional(),
  can_approve: z.boolean().optional(),
  is_super_admin: z.boolean().optional(),
};

export const roleCreateSchema = z.object({
  role_name: z.string().optional(),
  ...permissionFlags,
});

export const roleUpdateSchema = z.object({
  role_id: z.string().min(1, 'role_id wajib diisi'),
  role_name: z.string().optional(),
  ...permissionFlags,
});

export const userUpdateSchema = z.object({
  id: z.string().min(1, 'id wajib diisi'),
  role_id: z.coerce.string().min(1, 'role_id wajib diisi'),
});

// ── Inventory: BOM ───────────────────────────────────────────────────────

export const bomCreateSchema = z.object({
  item_code: z.string().min(1, 'item_code wajib diisi'),
  qty: z.coerce.number().positive().optional(),
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
  mode_of_payment: z.string().optional(),
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
    name: z.string().optional(),
    photo_url: z.string().optional(),
    phone: z.string().optional(),
    date_of_birth: z.string().optional(),
    address: z.string().optional(),
    gender: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    bio: z.string().optional(),
    current_password: z.string().optional(),
    new_password: z.string().optional(),
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
  source_warehouse: z.string().optional(),
  target_warehouse: z.string().optional(),
  qty: z.coerce.number().positive('qty harus lebih dari 0'),
  remarks: z.string().optional().nullable(),
  date: z.string().optional(),
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
    cloud_id: z.string().optional(),
    id: z.string().optional(),
    employee_name: z.string().optional(),
    attendance_date: z.string().optional(),
    jam_set: z.string().optional(),
    jam_absensi: z.string().optional(),
    verifikasi: z.string().optional(),
    tipe_absensi: z.string().optional(),
    designation: z.string().optional(),
    branch: z.string().optional(),
    remarks: z.string().optional().nullable(),
  })
);
