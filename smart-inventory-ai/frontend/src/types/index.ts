/**
 * TypeScript Data Contracts for Smart Inventory & Billing Frontend
 * Matches FastAPI backend REST API schemas exactly.
 */

export interface Product {
  stock_code: string;
  product_name: string;
  unit_price: number;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  safety_stock: number;
  minimum_stock: number;
  lead_time_days: number;
  is_active: boolean;
}

export interface ProductListResponse {
  total: number;
  page: number;
  page_size: number;
  products: Product[];
}

export interface ProductDetail extends Product {
  max_capacity?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastResponse {
  stock_code: string;
  product_name: string;
  predicted_demand_7day: number;
  model_version: string;
  is_fallback: boolean;
  fallback_reason?: string | null;
  average_daily_demand: number;
  unit_price: number;
  current_stock: number;
  available_stock: number;
}

export type StockStatus =
  | 'OUT_OF_STOCK'
  | 'CRITICAL'
  | 'REORDER_REQUIRED'
  | 'HEALTHY'
  | 'OVERSTOCKED';

export interface ReorderItem {
  stock_code: string;
  product_name: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  safety_stock: number;
  lead_time_days: number;
  predicted_7day_demand: number;
  reorder_point: number;
  recommended_reorder_qty: number;
  final_order_quantity: number;
  stock_status: StockStatus;
  explanation: string;
  is_fallback: boolean;
  fallback_reason?: string | null;
}

export interface ReorderListResponse {
  total: number;
  items: ReorderItem[];
  summary: Record<string, number>;
}

export interface DashboardSummary {
  total_products: number;
  active_products: number;
  out_of_stock_count: number;
  critical_stock_count: number;
  low_stock_count: number;
  healthy_stock_count: number;
  total_inventory_units: number;
  total_inventory_value: number;
  total_invoices: number;
  total_revenue: number;
  daily_sales_records: number;
  model_loaded: boolean;
}

export interface TopAlert {
  stock_code: string;
  product_name: string;
  available_stock: number;
  minimum_stock: number;
  safety_stock: number;
  alert_level: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW_STOCK';
}

export interface DashboardResponse {
  summary: DashboardSummary;
  top_alerts: TopAlert[];
}

export interface CartItem {
  stock_code: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  available_stock: number;
  line_total: number;
}

export interface CheckoutRequest {
  items: { stock_code: string; quantity: number }[];
  customer_name: string;
  customer_phone?: string;
  payment_method: 'CASH' | 'CARD' | 'UPI' | 'CREDIT';
}

export interface InvoiceItemOut {
  stock_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface InvoiceReceipt {
  invoice_id: number;
  invoice_no: string;
  customer_name: string;
  customer_phone?: string;
  payment_method: string;
  total_amount: number;
  items: InvoiceItemOut[];
}

export interface InvoiceSummary {
  invoice_id: number;
  invoice_no: string;
  invoice_date: string;
  customer_name: string;
  total_amount: number;
  payment_method: string;
  status: string;
}

export interface InvoiceListResponse {
  total: number;
  invoices: InvoiceSummary[];
}
