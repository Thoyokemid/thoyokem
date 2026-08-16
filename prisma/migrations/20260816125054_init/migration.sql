-- CreateTable
CREATE TABLE "roles" (
    "role_id" TEXT NOT NULL,
    "role_name" TEXT NOT NULL,
    "dashboard" BOOLEAN NOT NULL DEFAULT false,
    "attendance" BOOLEAN NOT NULL DEFAULT false,
    "leave" BOOLEAN NOT NULL DEFAULT false,
    "registration_request" BOOLEAN NOT NULL DEFAULT false,
    "setting" BOOLEAN NOT NULL DEFAULT false,
    "staff" BOOLEAN NOT NULL DEFAULT false,
    "inventory" BOOLEAN NOT NULL DEFAULT false,
    "purchasing" BOOLEAN NOT NULL DEFAULT false,
    "sales_order" BOOLEAN NOT NULL DEFAULT false,
    "delivery_order" BOOLEAN NOT NULL DEFAULT false,
    "can_approve" BOOLEAN NOT NULL DEFAULT false,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "last_active" TEXT,
    "photo_url" TEXT,
    "phone" TEXT,
    "date_of_birth" TEXT,
    "address" TEXT,
    "gender" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "bio" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TEXT NOT NULL,
    "update_at" TEXT NOT NULL,

    CONSTRAINT "registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_list" (
    "employee_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "date_of_birth" TEXT,
    "leave_allocation" INTEGER,

    CONSTRAINT "staff_list_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "leave_attendance" (
    "id" TEXT NOT NULL,
    "employee" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "from_date" TEXT NOT NULL,
    "to_date" TEXT NOT NULL,
    "leave_type" TEXT NOT NULL,
    "attachment" TEXT,
    "description" TEXT,
    "created_at" TEXT NOT NULL,
    "update_at" TEXT NOT NULL,

    CONSTRAINT "leave_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_import" (
    "cloud_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "attendance_date" TEXT NOT NULL,
    "jam_set" TEXT NOT NULL,
    "jam_absensi" TEXT NOT NULL,
    "verifikasi" TEXT NOT NULL,
    "tipe_absensi" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "attendance_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_list" (
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_group" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "purchase_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "selling_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_level" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "valuation_method" TEXT NOT NULL DEFAULT 'FIFO',
    "opening_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "opening_valuation_rate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "item_type" TEXT NOT NULL DEFAULT 'Trading',

    CONSTRAINT "item_list_pkey" PRIMARY KEY ("item_code")
);

-- CreateTable
CREATE TABLE "warehouse_list" (
    "warehouse_id" TEXT NOT NULL,
    "warehouse_name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "pic" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "postal_code" TEXT,

    CONSTRAINT "warehouse_list_pkey" PRIMARY KEY ("warehouse_id")
);

-- CreateTable
CREATE TABLE "bom" (
    "bom_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "owner" TEXT NOT NULL,
    "creation" TEXT NOT NULL,

    CONSTRAINT "bom_pkey" PRIMARY KEY ("bom_id")
);

-- CreateTable
CREATE TABLE "bom_item" (
    "id" SERIAL NOT NULL,
    "bom_id" TEXT NOT NULL,
    "component_item_code" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "bom_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_entry" (
    "entry_id" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "source_warehouse" TEXT,
    "target_warehouse" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "date" TEXT NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "creation" TEXT NOT NULL,

    CONSTRAINT "stock_entry_pkey" PRIMARY KEY ("entry_id")
);

-- CreateTable
CREATE TABLE "stock_ledger_entry" (
    "entry_id" TEXT NOT NULL,
    "posting_date" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "voucher_type" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "actual_qty" DECIMAL(18,4) NOT NULL,
    "valuation_rate" DECIMAL(18,4) NOT NULL,
    "qty_after_transaction" DECIMAL(18,4) NOT NULL,
    "stock_value" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "stock_ledger_entry_pkey" PRIMARY KEY ("entry_id")
);

-- CreateTable
CREATE TABLE "supplier_list" (
    "supplier_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "payment_terms" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "supplier_list_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "po_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "order_date" TEXT NOT NULL,
    "expected_date" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "total_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "owner" TEXT NOT NULL,
    "creation" TEXT NOT NULL,
    "amended_from" TEXT,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("po_id")
);

-- CreateTable
CREATE TABLE "purchase_order_item" (
    "id" SERIAL NOT NULL,
    "po_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "received_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "warehouse_id" TEXT NOT NULL,

    CONSTRAINT "purchase_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt" (
    "pr_id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "posting_date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approval_status" TEXT,
    "owner" TEXT NOT NULL,
    "creation" TEXT NOT NULL,

    CONSTRAINT "purchase_receipt_pkey" PRIMARY KEY ("pr_id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_item" (
    "id" SERIAL NOT NULL,
    "pr_id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "received_qty" DECIMAL(18,4) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "purchase_receipt_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice" (
    "pi_id" TEXT NOT NULL,
    "po_id" TEXT,
    "pr_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "posting_date" TEXT NOT NULL,
    "due_date" TEXT,
    "grand_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "owner" TEXT NOT NULL,
    "creation" TEXT NOT NULL,

    CONSTRAINT "purchase_invoice_pkey" PRIMARY KEY ("pi_id")
);

-- CreateTable
CREATE TABLE "customer_list" (
    "customer_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "payment_terms" TEXT,
    "credit_limit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "customer_list_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "sales_order" (
    "so_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" TEXT NOT NULL,
    "delivery_date" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "total_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "owner" TEXT NOT NULL,
    "creation" TEXT NOT NULL,
    "amended_from" TEXT,

    CONSTRAINT "sales_order_pkey" PRIMARY KEY ("so_id")
);

-- CreateTable
CREATE TABLE "sales_order_item" (
    "id" SERIAL NOT NULL,
    "so_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "delivered_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "warehouse_id" TEXT NOT NULL,

    CONSTRAINT "sales_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_note" (
    "dn_id" TEXT NOT NULL,
    "so_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "posting_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Unallocated',
    "owner" TEXT NOT NULL,
    "creation" TEXT NOT NULL,
    "amended_from" TEXT,

    CONSTRAINT "delivery_note_pkey" PRIMARY KEY ("dn_id")
);

-- CreateTable
CREATE TABLE "delivery_note_item" (
    "id" SERIAL NOT NULL,
    "dn_id" TEXT NOT NULL,
    "so_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "delivered_qty" DECIMAL(18,4) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "delivery_note_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice" (
    "si_id" TEXT NOT NULL,
    "so_id" TEXT,
    "dn_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "posting_date" TEXT NOT NULL,
    "due_date" TEXT,
    "grand_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "owner" TEXT NOT NULL,
    "creation" TEXT NOT NULL,

    CONSTRAINT "sales_invoice_pkey" PRIMARY KEY ("si_id")
);

-- CreateTable
CREATE TABLE "payment_entry" (
    "payment_id" TEXT NOT NULL,
    "payment_type" TEXT NOT NULL,
    "party_type" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "paid_amount" DECIMAL(18,4) NOT NULL,
    "posting_date" TEXT NOT NULL,
    "mode_of_payment" TEXT,
    "status" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "creation" TEXT NOT NULL,

    CONSTRAINT "payment_entry_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "log_id" TEXT NOT NULL,
    "doctype" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "changes" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "comments" (
    "comment_id" TEXT NOT NULL,
    "doctype" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mentions" TEXT,
    "timestamp" TEXT NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("comment_id")
);

-- CreateTable
CREATE TABLE "numbering_series" (
    "series_name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "current_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "numbering_series_pkey" PRIMARY KEY ("series_name")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "staff_list_user_id_key" ON "staff_list"("user_id");

-- CreateIndex
CREATE INDEX "activity_log_doctype_document_id_idx" ON "activity_log"("doctype", "document_id");

-- CreateIndex
CREATE INDEX "comments_doctype_document_id_idx" ON "comments"("doctype", "document_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_list" ADD CONSTRAINT "staff_list_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_attendance" ADD CONSTRAINT "leave_attendance_employee_fkey" FOREIGN KEY ("employee") REFERENCES "staff_list"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_item" ADD CONSTRAINT "bom_item_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bom"("bom_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("po_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_item" ADD CONSTRAINT "sales_order_item_so_id_fkey" FOREIGN KEY ("so_id") REFERENCES "sales_order"("so_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_item" ADD CONSTRAINT "delivery_note_item_dn_id_fkey" FOREIGN KEY ("dn_id") REFERENCES "delivery_note"("dn_id") ON DELETE RESTRICT ON UPDATE CASCADE;
