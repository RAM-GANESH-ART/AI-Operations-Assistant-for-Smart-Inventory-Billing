import {
  CheckoutRequest,
  DashboardResponse,
  ForecastResponse,
  InvoiceListResponse,
  InvoiceReceipt,
  ProductDetail,
  ProductListResponse,
  ReorderListResponse,
} from '../types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        if (typeof errJson.detail === 'string') {
          errorMsg = errJson.detail;
        } else if (Array.isArray(errJson.detail)) {
          errorMsg = errJson.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        }
      }
    } catch {
      // Use fallback errorMsg
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // System Health
  async getHealth(): Promise<{ status: string; model_loaded: boolean; project: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },

  // Dashboard Overview
  async getDashboardSummary(): Promise<DashboardResponse> {
    const res = await fetch(`${API_BASE}/dashboard/summary`);
    return handleResponse<DashboardResponse>(res);
  },

  // Products Catalog
  async getProducts(params?: {
    search?: string;
    category?: string;
    low_stock?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<ProductListResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category && params.category.toLowerCase() !== 'all') query.append('category', params.category);
    if (params?.low_stock) query.append('low_stock', 'true');
    if (params?.page) query.append('page', params.page.toString());
    if (params?.page_size) query.append('page_size', params.page_size.toString());

    const res = await fetch(`${API_BASE}/products?${query.toString()}`);
    return handleResponse<ProductListResponse>(res);
  },

  async getProduct(stockCode: string): Promise<ProductDetail> {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(stockCode)}`);
    return handleResponse<ProductDetail>(res);
  },

  // Demand Forecast
  async getForecast(stockCode: string): Promise<ForecastResponse> {
    const res = await fetch(`${API_BASE}/forecast/${encodeURIComponent(stockCode)}`);
    return handleResponse<ForecastResponse>(res);
  },

  // Reorder Recommendations
  async getReorderRecommendations(params?: {
    status_filter?: string;
    limit?: number;
  }): Promise<ReorderListResponse> {
    const query = new URLSearchParams();
    if (params?.status_filter && params.status_filter !== 'ALL') {
      query.append('status_filter', params.status_filter);
    }
    if (params?.limit) query.append('limit', params.limit.toString());

    const res = await fetch(`${API_BASE}/reorder-recommendations?${query.toString()}`);
    return handleResponse<ReorderListResponse>(res);
  },

  // POS Billing & Checkout
  async checkout(request: CheckoutRequest, idempotencyKey?: string): Promise<InvoiceReceipt> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await fetch(`${API_BASE}/billing/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    return handleResponse<InvoiceReceipt>(res);
  },

  // Invoices
  async getInvoices(limit = 20, status?: string): Promise<InvoiceListResponse> {
    const query = new URLSearchParams();
    query.append('limit', limit.toString());
    if (status) query.append('status', status);

    const res = await fetch(`${API_BASE}/invoices?${query.toString()}`);
    return handleResponse<InvoiceListResponse>(res);
  },

  async getInvoice(invoiceNo: string): Promise<InvoiceReceipt> {
    const res = await fetch(`${API_BASE}/invoices/${encodeURIComponent(invoiceNo)}`);
    return handleResponse<InvoiceReceipt>(res);
  },
};
