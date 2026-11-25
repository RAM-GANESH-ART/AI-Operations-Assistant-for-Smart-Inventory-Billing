import React, { useState } from 'react';
import { Product, ScreenId } from '../types';

interface InventoryScreenProps {
  products: Product[];
  onNavigateToForecast: (sku: string) => void;
  onAddToCart: (product: Product) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  products,
  onNavigateToForecast,
  onAddToCart,
  onShowToast,
}) => {
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Add/Edit Product Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Grocery');
  const [formSku, setFormSku] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formStock, setFormStock] = useState<string>('');
  const [formMinStock, setFormMinStock] = useState<string>('');

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory('Grocery');
    setFormSku(`SKU-${Math.floor(10000 + Math.random() * 90000)}`);
    setFormPrice('50.00');
    setFormStock('100');
    setFormMinStock('20');
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.product_name);
    setFormCategory(p.category || 'Grocery');
    setFormSku(p.stock_code);
    setFormPrice(p.unit_price.toString());
    setFormStock(p.available_stock.toString());
    setFormMinStock(p.minimum_stock.toString());
    setModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice || !formStock) {
      onShowToast('Please fill in all required fields.', 'warning');
      return;
    }
    setModalOpen(false);
    onShowToast(`Product "${formName}" saved successfully!`, 'success');
  };

  // Filter products
  const filtered = products.filter((p) => {
    const matchesCat =
      categoryFilter === 'all' ||
      (p.category && p.category.toLowerCase() === categoryFilter.toLowerCase());
    const matchesSearch =
      !search.trim() ||
      p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      p.stock_code.toLowerCase().includes(search.toLowerCase());

    const isOutOfStock = p.available_stock <= 0;
    const isLow = p.available_stock > 0 && p.available_stock <= p.minimum_stock;
    const isInStock = p.available_stock > p.minimum_stock;

    let matchesStatus = true;
    if (statusFilter === 'In Stock') matchesStatus = isInStock;
    else if (statusFilter === 'Low Stock') matchesStatus = isLow;
    else if (statusFilter === 'Out of Stock') matchesStatus = isOutOfStock;

    return matchesCat && matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="screen active" id="screen-inventory">
      <div className="screen-header">
        <div>
          <h1>Inventory Management</h1>
          <p className="screen-subtitle">Manage your products and stock</p>
        </div>
        <button className="btn-primary" id="add-product-btn" onClick={openAddModal}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Add Product
        </button>
      </div>

      <div className="inventory-filters">
        <div className="inv-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            id="inventory-search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select
          id="inv-category-filter"
          className="filter-select"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Categories</option>
          <option value="Grocery">Grocery</option>
          <option value="Dairy">Dairy</option>
          <option value="Beverages">Beverages</option>
          <option value="Snacks">Snacks</option>
          <option value="Personal">Personal</option>
          <option value="Bakery">Bakery</option>
          <option value="Household">Household</option>
        </select>

        <select
          id="inv-status-filter"
          className="filter-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Status</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
      </div>

      <div className="card table-card">
        <table className="data-table full-table" id="inventory-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Min Stock</th>
              <th>Status</th>
              <th>Sold</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="inventory-tbody">
            {paginated.map((p) => {
              const isOutOfStock = p.available_stock <= 0;
              const isLow = p.available_stock <= p.minimum_stock;

              return (
                <tr key={p.stock_code}>
                  <td style={{ fontWeight: 600 }}>{p.product_name}</td>
                  <td><span className="sku-mono">{p.stock_code}</span></td>
                  <td>{p.category || 'General'}</td>
                  <td>₹{p.unit_price.toFixed(2)}</td>
                  <td>
                    <strong style={{ color: isOutOfStock ? '#f87171' : isLow ? '#fbbf24' : '#34d399' }}>
                      {p.available_stock}
                    </strong>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.minimum_stock}</td>
                  <td>
                    {isOutOfStock ? (
                      <span className="badge badge-out">Out of Stock</span>
                    ) : isLow ? (
                      <span className="badge badge-critical">Low Stock</span>
                    ) : (
                      <span className="badge badge-healthy">In Stock</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.sold ?? Math.floor(p.unit_price * 1.5)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-outline btn-sm"
                        onClick={() => openEditModal(p)}
                        title="Edit product"
                      >
                        Edit
                      </button>
                      <button
                        className="btn-outline btn-sm"
                        onClick={() => onNavigateToForecast(p.stock_code)}
                        title="View ML Forecast"
                      >
                        Forecast
                      </button>
                      <button
                        className="btn-primary btn-sm"
                        disabled={isOutOfStock}
                        onClick={() => onAddToCart(p)}
                        title="Add to Billing cart"
                      >
                        + Bill
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="table-footer">
          <span id="inv-showing">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} products
          </span>
          <div className="pagination" id="inv-pagination">
            <button
              className="page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              &lt;
            </button>
            <span style={{ fontSize: '12px', padding: '0 8px' }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="modal-overlay" id="product-modal" style={{ display: 'flex' }} onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="product-modal-title">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button className="modal-close" id="close-product-modal" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Product Name <span style={{ color: 'var(--red)' }}>*</span></label>
                    <input
                      type="text"
                      id="prod-name"
                      placeholder="e.g. Amul Milk (1L)"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      id="prod-category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    >
                      <option value="Snacks">Snacks</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Dairy">Dairy</option>
                      <option value="Grocery">Grocery</option>
                      <option value="Household">Household</option>
                      <option value="Personal">Personal</option>
                      <option value="Beverages">Beverages</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>SKU <span className="sku-badge">Locked &bull; Auto</span></label>
                    <input type="text" id="prod-sku" value={formSku} readOnly tabIndex={-1} />
                    <span className="field-hint">Auto-generated sequential code for category</span>
                  </div>

                  <div className="form-group">
                    <label>Price (₹) <span style={{ color: 'var(--red)' }}>*</span></label>
                    <input
                      type="number"
                      id="prod-price"
                      min="0.01"
                      step="0.01"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      required
                    />
                    <span className="field-hint">Must be greater than ₹0</span>
                  </div>

                  <div className="form-group">
                    <label>Current Stock <span style={{ color: 'var(--red)' }}>*</span></label>
                    <input
                      type="number"
                      id="prod-stock"
                      min="0"
                      step="1"
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      required
                    />
                    <span className="field-hint">Units in storage (&ge; 0)</span>
                  </div>

                  <div className="form-group">
                    <label>Min Stock <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Safety threshold)</span></label>
                    <input
                      type="number"
                      id="prod-min-stock"
                      min="0"
                      step="1"
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(e.target.value)}
                      required
                    />
                    <span className="field-hint">Reorder trigger level (&ge; 0)</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-outline" id="cancel-product-modal" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" id="save-product">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
