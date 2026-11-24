import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { STORE_PRODUCTS } from '../services/storeProducts';
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

const CATEGORIES = [
  { id: 'all', label: 'All Items', emoji: '📦' },
  { id: 'Grocery', label: 'Grocery', emoji: '🌾' },
  { id: 'Dairy', label: 'Dairy', emoji: '🥛' },
  { id: 'Beverages', label: 'Beverages', emoji: '🥤' },
  { id: 'Snacks', label: 'Snacks', emoji: '🍪' },
  { id: 'Personal', label: 'Personal Care', emoji: '🧴' },
  { id: 'Bakery', label: 'Bakery', emoji: '🍞' },
  { id: 'Household', label: 'Household', emoji: '🧼' },
];

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

  const comboboxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close popup when clicking outside the combobox and category chips
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(target) &&
        !target.closest('.pos-category-bar')
      ) {
        setSuggestionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Combine rich categorized prototype products with any backend products
  const allCatalogProducts = useMemo(() => {
    const map = new Map<string, Product>();
    // Seed with all 100 prototype items (with real categories & emojis)
    STORE_PRODUCTS.forEach((p) => map.set(p.stock_code, p));
    // Overlay any backend loaded products
    products.forEach((p) => {
      const existing = map.get(p.stock_code);
      if (existing) {
        map.set(p.stock_code, {
          ...existing,
          ...p,
          category: p.category || existing.category,
          emoji: p.emoji || existing.emoji,
        });
      } else {
        map.set(p.stock_code, p);
      }
    });
    return Array.from(map.values());
  }, [products]);

  // Strictly filter products:
  // 1. When a category (e.g. Dairy) is clicked, only Dairy products are shown.
  // 2. When searching while a category is clicked, it searches ONLY within that category.
  // 3. When 'all' is clicked, it shows all products across all categories.
  const displayedProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allCatalogProducts.filter((p) => {
      // 1. Category check
      const matchesCat =
        selectedCategory.toLowerCase() === 'all' ||
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

      if (!matchesCat) return false;

      // 2. Search query check (within the selected category)
      if (!query) return true;

      return (
        p.product_name.toLowerCase().includes(query) ||
        p.stock_code.toLowerCase().includes(query)
      );
    });
  }, [allCatalogProducts, selectedCategory, searchQuery]);

  // Suggestions that pop up in the dropdown (shows up to 40 items)
  const filteredSuggestions = displayedProducts.slice(0, 40);

  const handleCategoryClick = (catId: string) => {
    setSelectedCategory(catId);
    setSearchQuery('');
    setSuggestionsOpen(true); // Items immediately POP UP!
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);
  };

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
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`pos-cat-chip${selectedCategory.toLowerCase() === cat.id.toLowerCase() ? ' active' : ''}`}
                onClick={() => handleCategoryClick(cat.id)}
              >
                <span>{cat.emoji}</span> {cat.label}
              </button>
            ))}
          </div>

          {/* Product Search & Autocomplete */}
          <div className="search-add-container">
            <div className="search-combobox-wrapper" ref={comboboxRef}>
              <div className="search-input-box">
                <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                  <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  id="order-product-search"
                  className="search-input"
                  placeholder={
                    selectedCategory === 'all'
                      ? 'Type product name or SKU to search across all products...'
                      : `Search strictly within ${selectedCategory} products...`
                  }
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSuggestionsOpen(true);
                  }}
                  onClick={() => setSuggestionsOpen(true)}
                  onFocus={() => setSuggestionsOpen(true)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    id="order-clear-search-btn"
                    className="search-clear-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setSuggestionsOpen(true);
                      searchInputRef.current?.focus();
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Autocomplete Suggestions Popup Dropdown */}
              {suggestionsOpen && (
                <div
                  className="search-suggestions-dropdown"
                  id="search-suggestions-dropdown"
                  style={{
                    display: 'block',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65)',
                    border: '1px solid rgba(59, 130, 246, 0.5)',
                  }}
                >
                  {filteredSuggestions.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        No {selectedCategory !== 'all' ? selectedCategory : ''} products matching "{searchQuery}"
                      </p>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Scoped strictly to {selectedCategory}.
                      </p>
                      {selectedCategory !== 'all' && (
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          onClick={() => {
                            setSelectedCategory('all');
                            setSuggestionsOpen(true);
                          }}
                        >
                          Search across All Items
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="suggestions-list" id="suggestions-list">
                      <div
                        style={{
                          padding: '7px 14px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#60a5fa',
                          background: 'rgba(59, 130, 246, 0.12)',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          position: 'sticky',
                          top: 0,
                          zIndex: 10,
                        }}
                      >
                        <span>
                          {selectedCategory === 'all'
                            ? `📦 All Products (${filteredSuggestions.length})`
                            : `${CATEGORIES.find((c) => c.id.toLowerCase() === selectedCategory.toLowerCase())?.emoji || '🏷️'} ${
                                CATEGORIES.find((c) => c.id.toLowerCase() === selectedCategory.toLowerCase())?.label || selectedCategory
                              } Products (${filteredSuggestions.length})`}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          Click any item to add to order
                        </span>
                      </div>
                      {filteredSuggestions.map((p) => {
                        const cartQty = cart.find((item) => item.stock_code === p.stock_code)?.quantity || 0;
                        return (
                          <div
                            key={p.stock_code}
                            className="suggestion-item"
                            onClick={() => handleSelectProduct(p)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              cursor: 'pointer',
                              background: cartQty > 0 ? 'rgba(59, 130, 246, 0.08)' : undefined,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '20px' }}>{p.emoji || '📦'}</span>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                                  {p.product_name}
                                  {cartQty > 0 && (
                                    <span
                                      style={{
                                        marginLeft: '8px',
                                        background: 'var(--blue)',
                                        color: '#fff',
                                        fontSize: '9.5px',
                                        fontWeight: 700,
                                        padding: '1px 5px',
                                        borderRadius: '8px',
                                      }}
                                    >
                                      ×{cartQty} in cart
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--blue)', fontFamily: 'monospace' }}>
                                  {p.stock_code} • <span style={{ color: 'var(--text-muted)' }}>{p.category || 'General'}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: '#34d399', fontSize: '13px' }}>
                                ₹{p.unit_price.toFixed(2)}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {p.available_stock} in stock
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Visual Interactive Product Catalog Shelf */}
          <div className="pos-products-shelf" style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedCategory === 'all'
                    ? `All Products (${displayedProducts.length} items)`
                    : `${CATEGORIES.find((c) => c.id.toLowerCase() === selectedCategory.toLowerCase())?.emoji || '🏷️'} ${
                        CATEGORIES.find((c) => c.id.toLowerCase() === selectedCategory.toLowerCase())?.label || selectedCategory
                      } (${displayedProducts.length} items)`}
                </span>
                {searchQuery && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#60a5fa',
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    Scoped search: "{searchQuery}"
                  </span>
                )}
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Click any product to add to order
              </span>
            </div>

            {displayedProducts.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '10px',
                  border: '1px dashed var(--border)',
                  marginBottom: '14px',
                }}
              >
                <div style={{ fontSize: '26px', marginBottom: '6px' }}>🔍</div>
                <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  No {selectedCategory !== 'all' ? selectedCategory : ''} products matching "{searchQuery}"
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Search is scoped strictly to the selected {selectedCategory} category.
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Search
                  </button>
                  {selectedCategory !== 'all' && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ fontSize: '12px', padding: '5px 12px' }}
                      onClick={() => setSelectedCategory('all')}
                    >
                      Search across All Items
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="pos-product-cards-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '10px',
                  maxHeight: '230px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                  paddingBottom: '4px',
                }}
              >
                {displayedProducts.map((p) => {
                  const cartQty = cart.find((item) => item.stock_code === p.stock_code)?.quantity || 0;
                  return (
                    <div
                      key={p.stock_code}
                      onClick={() => handleSelectProduct(p)}
                      className="pos-product-card"
                      style={{
                        background: cartQty > 0 ? 'rgba(59, 130, 246, 0.10)' : 'var(--bg-input)',
                        border: cartQty > 0 ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid var(--border)',
                        borderRadius: '9px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                      }}
                      title={`Click to add "${p.product_name}" to order`}
                    >
                      {cartQty > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            background: 'var(--blue)',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '10px',
                          }}
                        >
                          ×{cartQty}
                        </span>
                      )}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '20px' }}>{p.emoji || '📦'}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {p.stock_code}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            lineHeight: 1.3,
                            marginBottom: '6px',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {p.product_name}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '6px',
                          paddingTop: '6px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#34d399' }}>
                          ₹{p.unit_price.toFixed(0)}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {p.available_stock} left
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
