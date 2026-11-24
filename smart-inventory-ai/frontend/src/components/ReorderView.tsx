import React, { useEffect, useState } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Edit3,
  TrendingUp,
} from 'lucide-react';
import { api } from '../services/api';
import { ReorderItem, StockStatus } from '../types';

interface ReorderViewProps {
  onNavigateToForecast: (stockCode: string) => void;
}

export const ReorderView: React.FC<ReorderViewProps> = ({ onNavigateToForecast }) => {
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>('ALL');
  const [limit, setLimit] = useState<number>(50);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Shop Owner Overrides (FR-2.5) local state map: stock_code -> override_quantity
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const fetchRecommendations = async (status = filter) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getReorderRecommendations({
        status_filter: status === 'ALL' ? undefined : status,
        limit,
      });
      setItems(res.items);
      setSummary(res.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load reorder recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(filter);
  }, [filter, limit]);

  const handleOverrideChange = (stockCode: string, value: string) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setOverrides((prev) => ({ ...prev, [stockCode]: parsed }));
    } else if (value === '') {
      setOverrides((prev) => {
        const copy = { ...prev };
        delete copy[stockCode];
        return copy;
      });
    }
  };

  const getStatusBadge = (status: StockStatus) => {
    switch (status) {
      case 'OUT_OF_STOCK':
        return <span className="badge badge-out">Out of Stock</span>;
      case 'CRITICAL':
        return <span className="badge badge-critical">Critical</span>;
      case 'REORDER_REQUIRED':
        return <span className="badge badge-reorder">Reorder Required</span>;
      case 'OVERSTOCKED':
        return <span className="badge badge-overstocked">Overstocked</span>;
      case 'HEALTHY':
      default:
        return <span className="badge badge-healthy">Healthy</span>;
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <RotateCcw size={26} style={{ color: '#38bdf8' }} />
            Automated Reorder Engine (SRS Phase 6)
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Formula: SuggestedOrderQty = ⌈max(0, PredictedDemand7Day + SafetyStock - AvailableStock)⌉
          </p>
        </div>

        <button className="btn btn-secondary" onClick={() => fetchRecommendations(filter)}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Recommendations</span>
        </button>
      </div>

      {/* Status Counters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: 'All Items' },
          { id: 'CRITICAL', label: `Critical (${summary.CRITICAL || 0})` },
          { id: 'REORDER_REQUIRED', label: `Reorder Required (${summary.REORDER_REQUIRED || 0})` },
          { id: 'OUT_OF_STOCK', label: `Out of Stock (${summary.OUT_OF_STOCK || 0})` },
          { id: 'HEALTHY', label: `Healthy (${summary.HEALTHY || 0})` },
          { id: 'OVERSTOCKED', label: `Overstocked (${summary.OVERSTOCKED || 0})` },
        ].map((btn) => (
          <button
            key={btn.id}
            className={`btn btn-sm ${filter === btn.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(btn.id)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert-box danger"><p>{error}</p></div>
      )}

      {/* Recommendations Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Available Stock</th>
              <th>Safety Stock</th>
              <th>7-Day Demand</th>
              <th>Reorder Point</th>
              <th>Suggested Qty</th>
              <th>Owner Override (FR-2.5)</th>
              <th>Status</th>
              <th>Explanation</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '3rem' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ color: '#38bdf8', margin: '0 auto 0.5rem auto' }} />
                  <p style={{ color: '#94a3b8' }}>Evaluating inventory buffer levels...</p>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No products matched status filter "{filter}".
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const hasOverride = overrides[item.stock_code] !== undefined;
                const finalQty = hasOverride ? overrides[item.stock_code] : item.recommended_reorder_qty;

                return (
                  <tr key={item.stock_code}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#60a5fa' }}>{item.stock_code}</td>
                    <td style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.product_name}
                    </td>
                    <td>
                      <strong style={{ color: item.available_stock <= 0 ? '#f87171' : '#e2e8f0' }}>
                        {item.available_stock}
                      </strong>
                    </td>
                    <td style={{ color: '#94a3b8' }}>{item.safety_stock}</td>
                    <td>{item.predicted_7day_demand.toFixed(1)}</td>
                    <td>{item.reorder_point.toFixed(1)}</td>
                    <td>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: item.recommended_reorder_qty > 0 ? '#38bdf8' : '#94a3b8' }}>
                        {item.recommended_reorder_qty}
                      </span>
                    </td>
                    {/* Shop Owner Manual Override Input (FR-2.5) */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <input
                          type="number"
                          min="0"
                          placeholder={item.recommended_reorder_qty.toString()}
                          value={overrides[item.stock_code] !== undefined ? overrides[item.stock_code] : ''}
                          onChange={(e) => handleOverrideChange(item.stock_code, e.target.value)}
                          style={{
                            width: '70px',
                            background: hasOverride ? 'rgba(59, 130, 246, 0.2)' : '#0f172a',
                            border: `1px solid ${hasOverride ? '#3b82f6' : '#334155'}`,
                            borderRadius: '6px',
                            color: 'white',
                            padding: '0.3rem 0.5rem',
                            fontSize: '0.875rem',
                          }}
                        />
                        {hasOverride && (
                          <span title="Owner override active" style={{ color: '#60a5fa', fontSize: '0.75rem' }}>
                            <Edit3 size={13} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{getStatusBadge(item.stock_status)}</td>
                    <td style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: '220px' }}>{item.explanation}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onNavigateToForecast(item.stock_code)}
                        title="View ML Forecast"
                      >
                        <TrendingUp size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
