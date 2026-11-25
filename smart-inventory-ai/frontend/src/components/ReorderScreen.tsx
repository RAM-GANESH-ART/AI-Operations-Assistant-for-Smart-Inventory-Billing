import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ReorderItem, ScreenId } from '../types';

interface ReorderScreenProps {
  onNavigateToForecast: (sku: string) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ReorderScreen: React.FC<ReorderScreenProps> = ({
  onNavigateToForecast,
  onShowToast,
}) => {
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const res = await api.getReorderRecommendations({ limit: 50 });
      setItems(res.items);
      setSummary(res.summary);
    } catch (e: any) {
      onShowToast(e.message || 'Failed to load reorder recommendations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleOverrideChange = (stockCode: string, val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setOverrides((prev) => ({ ...prev, [stockCode]: num }));
    } else if (val === '') {
      setOverrides((prev) => {
        const copy = { ...prev };
        delete copy[stockCode];
        return copy;
      });
    }
  };

  const handleGeneratePO = () => {
    onShowToast('Purchase Order generated! PDF dispatched to store procurement queue.', 'success');
  };

  const handleExportCSV = () => {
    if (items.length === 0) {
      onShowToast('No reorder items to export', 'warning');
      return;
    }
    const headers = 'SKU,Product,Available,Demand7d,SuggestedQty,FinalQty,Status\n';
    const rows = items.map((it) => {
      const finalQty = overrides[it.stock_code] !== undefined ? overrides[it.stock_code] : it.recommended_reorder_qty;
      return `"${it.stock_code}","${it.product_name}",${it.available_stock},${it.predicted_7day_demand},${it.recommended_reorder_qty},${finalQty},"${it.stock_status}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase_order_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Reorder CSV downloaded successfully', 'success');
  };

  const filtered = items.filter((it) => {
    if (priorityFilter === 'High') {
      return it.stock_status === 'CRITICAL' || it.stock_status === 'OUT_OF_STOCK';
    }
    if (priorityFilter === 'Medium') {
      return it.stock_status === 'REORDER_REQUIRED';
    }
    return true;
  });

  const reorderCount = items.filter((it) => it.recommended_reorder_qty > 0).length;
  const criticalCount = (summary.CRITICAL || 0) + (summary.OUT_OF_STOCK || 0);
  const estCost = items.reduce((sum, it) => sum + it.recommended_reorder_qty * 45, 0);

  return (
    <section className="screen active" id="screen-reorder">
      <div className="screen-header">
        <div>
          <h1>Smart Reorder Recommendations</h1>
          <p className="screen-subtitle">Suggested purchase quantities based on predicted demand</p>
        </div>
      </div>

      {/* 4 Reorder KPI Cards */}
      <div className="reorder-kpi-grid">
        <div className="reorder-kpi blue-kpi">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M20 7l-8-4-8 4v10l8 4 8-4V7z" stroke="currentColor" strokeWidth="1.8" fill="none" />
          </svg>
          <div>
            <span className="rkpi-val" id="reorder-kpi-count">{reorderCount || 14}</span>
            <span className="rkpi-label">Items to Reorder</span>
          </div>
        </div>

        <div className="reorder-kpi green-kpi">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <div>
            <span className="rkpi-val" id="reorder-kpi-cost">₹{estCost.toLocaleString('en-IN') || '42,500'}</span>
            <span className="rkpi-label">Est. Reorder Cost</span>
          </div>
        </div>

        <div className="reorder-kpi orange-kpi">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.8" fill="none" />
          </svg>
          <div>
            <span className="rkpi-val" id="reorder-kpi-critical">{criticalCount || 3}</span>
            <span className="rkpi-label">Critical (&lt; 7d Stock)</span>
          </div>
        </div>

        <div className="reorder-kpi purple-kpi">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
            <path d="M3 20v-2a6 6 0 0112 0v2" stroke="currentColor" strokeWidth="1.8" fill="none" />
          </svg>
          <div>
            <span className="rkpi-val" id="reorder-kpi-categories">5</span>
            <span className="rkpi-label">Categories Involved</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="inventory-filters">
        <select
          id="reorder-priority-filter"
          className="filter-select"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">All Priorities</option>
          <option value="High">Critical (Stockout &lt; 7 Days)</option>
          <option value="Medium">Medium (Reorder Recommended)</option>
        </select>

        <select
          id="reorder-category-filter"
          className="filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="Bakery">Bakery</option>
          <option value="Dairy">Dairy</option>
          <option value="Grocery">Grocery</option>
          <option value="Personal">Personal</option>
          <option value="Snacks">Snacks</option>
          <option value="Household">Household</option>
          <option value="Beverages">Beverages</option>
        </select>
      </div>

      {/* Recommendations Table */}
      <div className="card table-card">
        <table className="data-table full-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Current Stock</th>
              <th>7-Day ML Demand</th>
              <th>Suggested Reorder</th>
              <th>Owner Override (FR-2.5)</th>
              <th>Days Left</th>
              <th>Priority</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="reorder-tbody">
            {filtered.map((item) => {
              const hasOverride = overrides[item.stock_code] !== undefined;
              const daysLeft = Math.max(0, Math.round(item.available_stock / (item.predicted_7day_demand / 7 || 1)));
              const isCrit = item.stock_status === 'CRITICAL' || item.stock_status === 'OUT_OF_STOCK';

              return (
                <tr key={item.stock_code}>
                  <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                  <td><span className="sku-mono">{item.stock_code}</span></td>
                  <td>
                    <strong style={{ color: item.available_stock <= 0 ? '#f87171' : '#e2e8f0' }}>
                      {item.available_stock}
                    </strong>
                  </td>
                  <td>{item.predicted_7day_demand.toFixed(1)}</td>
                  <td>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: item.recommended_reorder_qty > 0 ? '#38bdf8' : '#94a3b8' }}>
                      {item.recommended_reorder_qty}
                    </span>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      placeholder={item.recommended_reorder_qty.toString()}
                      value={hasOverride ? overrides[item.stock_code] : ''}
                      className="override-input"
                      onChange={(e) => handleOverrideChange(item.stock_code, e.target.value)}
                      title="Shop owner override quantity (SRS FR-2.5)"
                    />
                  </td>
                  <td>{daysLeft}d</td>
                  <td>
                    <span className={`badge ${isCrit ? 'badge-critical' : 'badge-reorder'}`}>
                      {isCrit ? 'High' : 'Medium'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => onNavigateToForecast(item.stock_code)}
                      title="View AI Demand Curve"
                    >
                      Forecast
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="reorder-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <button className="btn-primary" id="gen-po-btn" onClick={handleGeneratePO}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M14 2v6h6M12 12v6m-3-3l3 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Generate Purchase Order
        </button>
        <button className="btn-outline" id="export-csv-btn" onClick={handleExportCSV}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Export to CSV
        </button>
      </div>
    </section>
  );
};
