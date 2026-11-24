import React, { useState } from 'react';
import {
  CreditCard,
  ShoppingCart,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Printer,
  X,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import { CartItem, InvoiceReceipt, Product } from '../types';

interface BillingTerminalProps {
  cart: CartItem[];
  onUpdateCartQuantity: (stockCode: string, qty: number) => void;
  onRemoveFromCart: (stockCode: string) => void;
  onClearCart: () => void;
  onAddToCart: (product: Product, qty: number) => void;
}

export const BillingTerminal: React.FC<BillingTerminalProps> = ({
  cart,
  onUpdateCartQuantity,
  onRemoveFromCart,
  onClearCart,
  onAddToCart,
}) => {
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'CREDIT'>('CASH');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<InvoiceReceipt | null>(null);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    try {
      setSearchLoading(true);
      const res = await api.getProducts({ search: q.trim(), page_size: 6 });
      setSearchResults(res.products);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  };

  const handleSelectProduct = (product: Product) => {
    onAddToCart(product, 1);
    setSearchQuery('');
    setSearchResults([]);
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.line_total, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      setCheckoutLoading(true);
      setCheckoutError(null);
      const idempotencyKey = `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const request = {
        items: cart.map((c) => ({ stock_code: c.stock_code, quantity: c.quantity })),
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim() || undefined,
        payment_method: paymentMethod,
      };
      const res = await api.checkout(request, idempotencyKey);
      setReceipt(res);
      onClearCart();
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed. Please review stock availability.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div>
      {checkoutError && (
        <div className="alert-box danger" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={16} />
          <div><strong>Billing Error:</strong> {checkoutError}</div>
        </div>
      )}

      <div className="billing-layout">
        {/* LEFT: Search + Cart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Product Search */}
          <div className="card product-search-wrap">
            <div className="search-bar">
              <Search size={15} />
              <input
                type="text"
                placeholder="Scan barcode or search product name / SKU..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchLoading && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>searching…</span>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="search-suggestions" style={{ position: 'absolute', left: 0, right: 0, top: '100%' }}>
                {searchResults.map((p) => (
                  <div key={p.stock_code} className="suggestion-item" onClick={() => handleSelectProduct(p)}>
                    <div>
                      <div className="suggestion-name">{p.product_name}</div>
                      <div className="suggestion-sku">{p.stock_code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="suggestion-price">₹{p.unit_price.toFixed(2)}</div>
                      <div className="suggestion-stock">Stock: {p.available_stock}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingCart size={15} /> Cart Items ({cart.length})
              </span>
              {cart.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={onClearCart}>Clear</button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="cart-empty">
                <ShoppingCart size={32} />
                <p>Cart is empty</p>
                <p style={{ fontSize: '12px' }}>Search products above or add from the Product Catalog</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.stock_code}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.product_name}</div>
                          <div className="sku-mono">{item.stock_code}</div>
                        </td>
                        <td>₹{item.unit_price.toFixed(2)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min={1}
                            max={item.available_stock}
                            value={item.quantity}
                            className="override-input"
                            onChange={(e) =>
                              onUpdateCartQuantity(item.stock_code, Math.max(1, parseInt(e.target.value) || 1))
                            }
                          />
                        </td>
                        <td style={{ color: '#34d399', fontWeight: 600 }}>₹{item.line_total.toFixed(2)}</td>
                        <td>
                          <button
                            className="btn btn-sm"
                            style={{ color: 'var(--red)', background: 'none', border: 'none', padding: '4px' }}
                            onClick={() => onRemoveFromCart(item.stock_code)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Checkout Panel */}
        <div className="card checkout-panel">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CreditCard size={15} /> Checkout Summary
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">Customer Name</label>
              <input
                type="text"
                className="form-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                className="form-input"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <div className="pay-pill-group">
                {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map((m) => (
                  <button
                    key={m}
                    className={`pay-pill${paymentMethod === m ? ' active' : ''}`}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="checkout-total-box">
            <div className="checkout-line">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal ({cart.length} items):</span>
              <span>₹{totalAmount.toFixed(2)}</span>
            </div>
            <div className="checkout-line">
              <span style={{ color: 'var(--text-secondary)' }}>GST / Taxes:</span>
              <span>Included</span>
            </div>
            <div className="checkout-grand">
              <span>Grand Total:</span>
              <span>₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="idempotency-note">
            <ShieldCheck size={14} style={{ color: 'var(--green)' }} />
            <span>Protected by PostgreSQL row-locks & Idempotency-Key safety</span>
          </div>

          <button
            className="btn btn-success btn-full btn-lg"
            disabled={cart.length === 0 || checkoutLoading}
            onClick={handleCheckout}
          >
            {checkoutLoading ? 'Processing…' : `Pay & Finalize  ₹${totalAmount.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <CheckCircle2 size={20} style={{ color: 'var(--green)' }} />
                Checkout Successful!
              </div>
              <button className="modal-close" onClick={() => setReceipt(null)}><X size={18} /></button>
            </div>

            <div className="receipt-box">
              <div className="receipt-store-name">SMART KIRANA STORE</div>
              <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Invoice: {receipt.invoice_no}
              </div>
              <hr className="receipt-divider" />

              <div className="receipt-row">
                <span style={{ color: 'var(--text-secondary)' }}>Customer:</span>
                <span>{receipt.customer_name}</span>
              </div>
              <div className="receipt-row">
                <span style={{ color: 'var(--text-secondary)' }}>Payment Mode:</span>
                <span style={{ fontWeight: 600 }}>{receipt.payment_method}</span>
              </div>
              <hr className="receipt-divider" />

              <table className="data-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((it) => (
                    <tr key={it.stock_code}>
                      <td style={{ padding: '6px 0' }}>{it.product_name}</td>
                      <td style={{ textAlign: 'center', padding: '6px 0' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>₹{it.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-row total">
                <span>Total Paid:</span>
                <span>₹{receipt.total_amount.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={14} /> Print
              </button>
              <button className="btn btn-primary" onClick={() => setReceipt(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
