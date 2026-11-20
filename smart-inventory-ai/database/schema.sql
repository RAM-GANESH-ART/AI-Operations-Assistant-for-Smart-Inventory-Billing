-- ============================================================================
-- Phase 7: Database Design and Integration
-- AI Operations Assistant for Smart Inventory & Billing
-- GLA University – Semester 3 Main Project
-- Target Database: PostgreSQL 16
-- ============================================================================
-- SCOPE ARCHITECTURE:
-- 1. CURRENT SCOPE (7 Core Tables):
--    - users               : User accounts and role-based access
--    - products            : Product catalog and inventory buffer levels
--    - stock_movements     : Immutable audit ledger of stock additions/deductions
--    - daily_product_sales : Clean historical daily sales ledger for forecasting
--    - demand_forecasts    : 7-day ML forecasts and Level 0 fallback records
--    - invoices            : Point-of-sale customer billing transactions
--    - invoice_items       : Line items associated with invoices
--
-- 2. FUTURE SCOPE (Documented for post-Phase 7 expansion):
--    - suppliers           : Supplier contact and procurement directory
--    - purchase_orders     : Automated and manual replenishment purchase orders
--    - purchase_order_items: Line items on purchase orders
-- ============================================================================

-- Drop tables in reverse order of foreign key dependency if re-deploying
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS demand_forecasts CASCADE;
DROP TABLE IF EXISTS daily_product_sales CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Optional future scope drops
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- ============================================================================
-- PART 1: CURRENT SCOPE – THE 7 CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Users Table (Authentication & Access Control)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. Products Table (Master Catalog & Operational Stock Levels)
-- Maps to UCI StockCode and application fields from SRS Section 2.2 & 2.3
-- ----------------------------------------------------------------------------
CREATE TABLE products (
    stock_code VARCHAR(30) PRIMARY KEY,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    minimum_stock INTEGER NOT NULL DEFAULT 10 CHECK (minimum_stock >= 0),
    safety_stock INTEGER NOT NULL DEFAULT 10 CHECK (safety_stock >= 0),
    reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
    lead_time_days INTEGER NOT NULL DEFAULT 3 CHECK (lead_time_days > 0),
    max_capacity INTEGER CHECK (max_capacity IS NULL OR max_capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_reserved_le_current CHECK (reserved_stock <= current_stock)
);

-- ----------------------------------------------------------------------------
-- 3. Stock Movements Table (Immutable Audit Ledger)
-- Tracks additions, sales, returns and manual adjustments
-- ----------------------------------------------------------------------------
CREATE TABLE stock_movements (
    movement_id BIGSERIAL PRIMARY KEY,
    stock_code VARCHAR(30) NOT NULL REFERENCES products(stock_code) ON DELETE RESTRICT,
    movement_type VARCHAR(20) NOT NULL CHECK (
        movement_type IN ('SALE', 'PURCHASE', 'RETURN', 'ADJUSTMENT', 'RESERVATION')
    ),
    quantity INTEGER NOT NULL CHECK (quantity != 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reference_id VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. Daily Product Sales Table (Historical Aggregates for ML Pipeline)
-- Populated from processed_daily_sales.csv
-- ----------------------------------------------------------------------------
CREATE TABLE daily_product_sales (
    sale_id BIGSERIAL PRIMARY KEY,
    stock_code VARCHAR(30) NOT NULL REFERENCES products(stock_code) ON DELETE CASCADE,
    sale_date DATE NOT NULL,
    units_sold INTEGER NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_sale_date UNIQUE (stock_code, sale_date)
);

-- ----------------------------------------------------------------------------
-- 5. Demand Forecasts Table (ML 7-Day Predictions & Baseline Fallbacks)
-- Maps to SRS Section 2.2, FR-2.2, FR-2.4
-- ----------------------------------------------------------------------------
CREATE TABLE demand_forecasts (
    forecast_id BIGSERIAL PRIMARY KEY,
    stock_code VARCHAR(30) NOT NULL REFERENCES products(stock_code) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    horizon_days INTEGER NOT NULL DEFAULT 7 CHECK (horizon_days > 0),
    predicted_demand NUMERIC(10, 4) NOT NULL CHECK (predicted_demand >= 0),
    model_version VARCHAR(50) NOT NULL DEFAULT 'RF-DEPTH-10',
    is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    fallback_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 6. Invoices Table (Point-of-Sale Billing Information)
-- Maps to SRS Section 6, NFR-4: Transactional Billing
-- ----------------------------------------------------------------------------
CREATE TABLE invoices (
    invoice_id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    invoice_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_name VARCHAR(100) NOT NULL DEFAULT 'Walk-in Customer',
    customer_phone VARCHAR(30),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (
        payment_method IN ('CASH', 'CARD', 'UPI', 'CREDIT')
    ),
    status VARCHAR(20) NOT NULL DEFAULT 'PAID' CHECK (
        status IN ('PAID', 'CANCELLED', 'REFUNDED')
    ),
    created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 7. Invoice Items Table (Individual Products on Invoices)
-- ----------------------------------------------------------------------------
CREATE TABLE invoice_items (
    invoice_item_id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    stock_code VARCHAR(30) NOT NULL REFERENCES products(stock_code) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0)
);

-- ----------------------------------------------------------------------------
-- Performance Indexes for Core Tables
-- ----------------------------------------------------------------------------
CREATE INDEX idx_products_stock_code ON products(stock_code);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_stock_movements_stock_code ON stock_movements(stock_code);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX idx_daily_sales_product_date ON daily_product_sales(stock_code, sale_date);
CREATE INDEX idx_daily_sales_date ON daily_product_sales(sale_date);
CREATE INDEX idx_forecasts_stock_date ON demand_forecasts(stock_code, forecast_date);
CREATE INDEX idx_invoices_no ON invoices(invoice_no);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_stock_code ON invoice_items(stock_code);

-- ----------------------------------------------------------------------------
-- 8. Idempotency Keys Table (POS Double-Billing & Retry Protection)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('IN_PROGRESS', 'SUCCEEDED', 'FAILED')),
    response_code INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys(created_at);

-- ============================================================================
-- PART 2: FUTURE SCOPE – SUPPLIER & PURCHASE ORDER MANAGEMENT (POST-PHASE 7)
-- Note: These tables are documented here for future system expansion.
-- They are NOT dependencies for the core Smart Inventory and Billing workflows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id SERIAL PRIMARY KEY,
    supplier_name VARCHAR(100) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(30),
    lead_time_days INTEGER NOT NULL DEFAULT 3 CHECK (lead_time_days > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'ORDERED', 'RECEIVED', 'CANCELLED')
    ),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    po_item_id SERIAL PRIMARY KEY,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    stock_code VARCHAR(30) NOT NULL REFERENCES products(stock_code) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    line_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(po_id);
