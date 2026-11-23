import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  ShoppingCart,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  PackageCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { Product, ProductDetail } from '../types';

interface CatalogProps {
  onNavigateToForecast: (stockCode: string) => void;
  onAddToCart: (product: Product, qty: number) => void;
}

export const Catalog: React.FC<CatalogProps> = ({ onNavigateToForecast, onAddToCart }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [search, setSearch] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected product detail modal
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const fetchProducts = async (p = page, q = search, low = lowStockOnly) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getProducts({
        page: p,
        page_size: pageSize,
        search: q.trim() || undefined,
        low_stock: low ? true : undefined,
      });
      setProducts(res.products);
      setTotal(res.total);
      setPage(res.page);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch product catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1, search, lowStockOnly);
  }, [lowStockOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(1, search, lowStockOnly);
  };

  const handleViewDetails = async (stockCode: string) => {
    try {
      setDetailLoading(true);
      const detail = await api.getProduct(stockCode);
      setSelectedProduct(detail);
    } catch (err: any) {
      alert(`Could not load details: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Product Catalog & Inventory</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Showing {total.toLocaleString()} total SKUs from PostgreSQL database
          </p>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} className="search-bar" style={{ minWidth: '280px' }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by SKU or product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <button
            className={`btn ${lowStockOnly ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLowStockOnly(!lowStockOnly)}
          >
            <Filter size={15} />
            <span>Low Stock Only</span>
          </button>

          <button className="btn btn-secondary" onClick={() => fetchProducts(page, search, lowStockOnly)}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-box alert-danger">
          <p>{error}</p>
        </div>
      )}

      {/* Product Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>SKU Code</th>
              <th>Product Name</th>
              <th>Unit Price</th>
              <th>Current Stock</th>
              <th>Available Stock</th>
              <th>Safety Stock</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 0.5rem auto' }} />
                  <p style={{ color: '#94a3b8' }}>Loading products...</p>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No products matched your search or filters.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isOutOfStock = p.available_stock <= 0;
                const isLow = p.available_stock <= p.minimum_stock;

                return (
                  <tr key={p.stock_code}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#60a5fa' }}>{p.stock_code}</td>
                    <td style={{ maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.product_name}
                    </td>
                    <td>₹{p.unit_price.toFixed(2)}</td>
                    <td>{p.current_stock}</td>
                    <td>
                      <strong style={{ color: isOutOfStock ? '#f87171' : isLow ? '#fbbf24' : '#34d399' }}>
                        {p.available_stock}
                      </strong>
                    </td>
                    <td style={{ color: '#94a3b8' }}>{p.safety_stock}</td>
                    <td>
                      {isOutOfStock ? (
                        <span className="badge badge-out">Out of Stock</span>
                      ) : isLow ? (
                        <span className="badge badge-critical">Low Stock</span>
                      ) : (
                        <span className="badge badge-healthy">Healthy</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewDetails(p.stock_code)}
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onNavigateToForecast(p.stock_code)}
                          title="Demand Forecast"
                        >
                          <TrendingUp size={13} style={{ color: '#c084fc' }} />
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onAddToCart(p, 1)}
                          disabled={isOutOfStock}
                          title={isOutOfStock ? 'Out of Stock' : 'Add to Billing Cart'}
                        >
                          <ShoppingCart size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>
        <div>
          Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} products
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchProducts(page - 1, search, lowStockOnly)}
            disabled={page <= 1 || loading}
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchProducts(page + 1, search, lowStockOnly)}
            disabled={page >= totalPages || loading}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedProduct && (
        <div className="modal-backdrop" onClick={() => setSelectedProduct(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontFamily: 'monospace' }}>
                  SKU: {selectedProduct.stock_code}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedProduct.product_name}</h3>
              </div>
              <button className="modal-close" onClick={() => setSelectedProduct(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Unit Selling Price</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#34d399' }}>
                  ₹{selectedProduct.unit_price.toFixed(2)}
                </div>
              </div>

              <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Available Stock</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#60a5fa' }}>
                  {selectedProduct.available_stock} units
                </div>
              </div>
            </div>

            <div style={{ background: '#182234', padding: '1rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Physical Current Stock:</span>
                <span>{selectedProduct.current_stock} units</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Reserved Stock:</span>
                <span>{selectedProduct.reserved_stock} units</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Configured Minimum Stock:</span>
                <span>{selectedProduct.minimum_stock} units</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Safety Stock Buffer:</span>
                <span>{selectedProduct.safety_stock} units</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Supplier Lead Time:</span>
                <span>{selectedProduct.lead_time_days} days</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const sku = selectedProduct.stock_code;
                  setSelectedProduct(null);
                  onNavigateToForecast(sku);
                }}
              >
                <TrendingUp size={16} />
                <span>Demand Forecast</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onAddToCart(selectedProduct, 1);
                  setSelectedProduct(null);
                }}
                disabled={selectedProduct.available_stock <= 0}
              >
                <ShoppingCart size={16} />
                <span>Add to Billing Cart</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
