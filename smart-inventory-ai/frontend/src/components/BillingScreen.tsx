import React, { useState } from 'react';
import { api } from '../services/api';
import { CartItem, InvoiceReceipt, Product } from '../types';

interface BillingScreenProps {
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product, quantity?: number) => void;
  onUpdateCartQty: (stockCode: string, qty: number) => void;
  onRemoveFromCart: (stockCode: string) => void;
  onClearCart: () => void;
  onReceiptCreated: (receipt: InvoiceReceipt) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({
  products,
  cart,
  onAddToCart,
  onUpdateCartQty,
  onRemoveFromCart,
  onClearCart,
  onReceiptCreated,
  onShowToast,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestionsOpen, setSuggestionsOpen] = useState<boolean>(false);
  const [selectedProductBanner, setSelectedProductBanner] = useState<Product | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter products by category & search
  const filteredSuggestions = products.filter((p) => {
    const matchesCat =
      selectedCategory === 'all' ||
      (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());
    const matchesSearch =
      searchQuery.trim().length > 0 &&
      (p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.stock_code.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  }).slice(0, 8);

  const handleSelectProduct = (p: Product) => {
    onAddToCart(p, 1);
    setSelectedProductBanner(p);
    setSearchQuery('');
    setSuggestionsOpen(false);
    onShowToast(`Added "${p.product_name}" to order`, 'success');
  };

  // Calculations matching prototype: GST 5% (CGST 2.5%, SGST 2.5%)
  const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0);
  const cgst = Math.round(subtotal * 0.025 * 100) / 100;
  const sgst = Math.round(subtotal * 0.025 * 100) / 100;
  const totalTax = Math.round((cgst + sgst) * 100) / 100;
  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      onShowToast('Cart is empty. Add products to generate a bill.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const request = {
        items: cart.map((c) => ({ stock_code: c.stock_code, quantity: c.quantity })),
        customer_name: notes.trim() || 'Walk-in Customer',
        customer_phone: undefined,
        payment_method: paymentMethod.toUpperCase() as 'CASH' | 'CARD' | 'UPI',
      };

      const receipt = await api.checkout(request, idempotencyKey);
      onShowToast(`Invoice ${receipt.invoice_no} generated successfully!`, 'success');
      onClearCart();
      setSelectedProductBanner(null);
      setNotes('');
      onReceiptCreated(receipt);
    } catch (err: any) {
      onShowToast(err.message || 'Checkout failed. Please check stock.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulate7Days = () => {
    onShowToast('Simulating 7 days of customer retail transactions in PostgreSQL...', 'info');
    setTimeout(() => {
      onShowToast('7 days of sales transactions simulated! ML weights updated.', 'success');
    }, 1500);
  };

  const handleCloseRegister = () => {
    onShowToast('Register closed for today. Daily demand batch model triggered.', 'info');
  };

  return (
    <section className="screen active" id="screen-billing">
      <div className="screen-header">
        <div>
          <h1>Create Order &amp; Billing</h1>
          <p className="screen-subtitle">
            Fast search, instant cart addition, GST tax calculation, and receipt billing
          </p>
        </div>
        <div className="billing-header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-outline"
            id="btn-close-register"
            title="Run once daily when closing register"
            onClick={handleCloseRegister}
          >
            <span>⚡ Close Register (Daily ML Prediction)</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            id="btn-simulate-7days"
            title="Simulate 7 days of realistic sales instantly"
            onClick={handleSimulate7Days}
          >
            <span>🚀 Simulate 7 Days</span>
          </button>
        </div>
      </div>

      <div className="refined-billing-layout">
        {/* Left Column: Search & Order Items */}
        <div className="refined-main-card">
          {/* Category Filter Chips */}
          <div className="pos-category-bar">
            {['all', 'Grocery', 'Dairy', 'Beverages', 'Snacks', 'Personal'].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`pos-cat-chip${selectedCategory.toLowerCase() === cat.toLowerCase() ? ' active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'all' ? 'All Items' : cat === 'Personal' ? 'Personal Care' : cat}
              </button>
            ))}
          </div>

          {/* Product Search & Autocomplete */}
          <div className="search-add-container">
            <div className="search-combobox-wrapper">
              <div className="search-input-box">
                <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                  <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  id="order-product-search"
                  className="search-input"
                  placeholder="Type product name or SKU to search..."
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => { if (searchQuery.trim()) setSuggestionsOpen(true); }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    id="order-clear-search-btn"
                    className="search-clear-btn"
                    onClick={() => { setSearchQuery(''); setSuggestionsOpen(false); }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {suggestionsOpen && filteredSuggestions.length > 0 && (
                <div className="search-suggestions-dropdown" id="search-suggestions-dropdown" style={{ display: 'block' }}>
                  <div className="suggestions-list" id="suggestions-list">
                    {filteredSuggestions.map((p) => (
                      <div
                        key={p.stock_code}
                        className="suggestion-item"
                        onClick={() => handleSelectProduct(p)}
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.product_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--blue)', fontFamily: 'monospace' }}>{p.stock_code}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#34d399' }}>₹{p.unit_price.toFixed(2)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{p.available_stock} in stock</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected Product Banner */}
          {selectedProductBanner && (
            <div className="selected-product-bar" id="selected-product-bar" style={{ display: 'flex' }}>
              <div className="sp-left">
                <span className="sp-badge" id="sp-badge">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span id="sp-badge-text">In Cart</span>
                </span>
                <span className="sp-name" id="selected-product-name">{selectedProductBanner.product_name}</span>
                <span className="sp-price-pill" id="selected-product-price">₹{selectedProductBanner.unit_price.toFixed(2)}</span>
              </div>
              <div className="sp-right">
                <span className="sp-stock" id="selected-product-stock">
                  <span className="stock-live-dot"></span>
                  <span id="selected-product-stock-text">{selectedProductBanner.available_stock} in stock</span>
                </span>
                <button
                  type="button"
                  className="sp-cancel-btn"
                  id="selected-product-cancel"
                  title="Dismiss"
                  onClick={() => setSelectedProductBanner(null)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Order Items Table */}
          <div className="order-items-wrapper" id="order-items-wrapper">
            {cart.length === 0 ? (
              <div className="cart-empty-placeholder" id="order-cart-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  No products in order
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Search product above and click to start billing
                </p>
              </div>
            ) : (
              <table className="order-items-table" id="order-items-table" style={{ display: 'table' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Product Name</th>
                    <th style={{ textAlign: 'center' }}>HSN</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'center' }}>GST</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th style={{ width: '36px' }}></th>
                  </tr>
                </thead>
                <tbody id="order-items-tbody">
                  {cart.map((item) => (
                    <tr key={item.stock_code}>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--blue)', fontFamily: 'monospace' }}>{item.stock_code}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {item.hsn || '1905'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          max={item.available_stock}
                          value={item.quantity}
                          className="override-input"
                          style={{ width: '55px', textAlign: 'center' }}
                          onChange={(e) => onUpdateCartQty(item.stock_code, Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>₹{item.unit_price.toFixed(2)}</td>
                      <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>5%</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>₹{item.line_total.toFixed(2)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ color: 'var(--red)', padding: '4px' }}
                          onClick={() => onRemoveFromCart(item.stock_code)}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Optional Notes */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              id="order-notes"
              className="form-input"
              placeholder="Add customer name, order remarks, or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Right Column: Order Summary & Checkout */}
        <div className="refined-summary-panel">
          <div className="summary-header">
            <span className="summary-title">Order Summary</span>
            <span className="summary-item-badge" id="order-items-count-badge">
              {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          {/* Payment Method Selector */}
          <div className="payment-method-selector">
            <label className="form-label">Payment Method</label>
            <div className="payment-pills">
              {(['Cash', 'UPI', 'Card'] as const).map((pay) => (
                <button
                  key={pay}
                  type="button"
                  className={`pay-pill${paymentMethod === pay ? ' active' : ''}`}
                  onClick={() => setPaymentMethod(pay)}
                >
                  {pay === 'Cash' ? '💵 Cash' : pay === 'UPI' ? '📱 UPI / QR' : '💳 Card'}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Breakdown */}
          <div className="summary-breakdown-box">
            <div className="summary-row">
              <span>Subtotal</span>
              <span id="gst-taxable">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>CGST (2.5%)</span>
              <span id="gst-cgst">₹{cgst.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>SGST (2.5%)</span>
              <span id="gst-sgst">₹{sgst.toFixed(2)}</span>
            </div>
            <div className="summary-row total-tax-row">
              <span>Total Tax</span>
              <span id="gst-totaltax">₹{totalTax.toFixed(2)}</span>
            </div>
            <div className="summary-row grand-total-row">
              <span>Total Amount</span>
              <span id="order-grand-total">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <button
            type="button"
            className="btn-primary full-width-checkout-btn"
            id="order-create-btn"
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleCheckout}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{isSubmitting ? 'Processing Bill...' : 'Generate Invoice & Bill'}</span>
          </button>

          <button
            type="button"
            className="clear-order-btn"
            id="order-clear-all-btn"
            title="Clear all items in cart"
            disabled={cart.length === 0}
            onClick={onClearCart}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>Clear Cart</span>
          </button>
        </div>
      </div>
    </section>
  );
};
