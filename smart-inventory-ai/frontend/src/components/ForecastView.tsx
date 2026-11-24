import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Brain,
  ShieldAlert,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { ForecastResponse } from '../types';

interface ForecastViewProps {
  initialStockCode?: string;
  onNavigateToReorder: () => void;
}

export const ForecastView: React.FC<ForecastViewProps> = ({ initialStockCode, onNavigateToReorder }) => {
  const [stockCode, setStockCode] = useState<string>(initialStockCode || '10002');
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = async (sku: string) => {
    if (!sku.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getForecast(sku.trim());
      setForecast(res);
    } catch (err: any) {
      setError(err.message || `No forecast available for SKU ${sku}`);
      setForecast(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialStockCode) {
      setStockCode(initialStockCode);
      fetchForecast(initialStockCode);
    } else {
      fetchForecast('10002');
    }
  }, [initialStockCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchForecast(stockCode);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Brain size={28} style={{ color: '#a855f7' }} />
          AI Demand Forecasting Engine
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          7-day product unit demand predictions served live by the trained Random Forest model (`RF-DEPTH-10`)
        </p>
      </div>

      {/* SKU Search Box */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: '1', minWidth: '240px' }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Enter SKU Code (e.g., 10002, 21915, 85123A)..."
              value={stockCode}
              onChange={(e) => setStockCode(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <TrendingUp size={16} />}
            <span>Generate 7-Day Forecast</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="alert-box danger">
          <ShieldAlert size={18} />
          <div>
            <strong>Prediction Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Forecast Result Card */}
      {forecast && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(145deg, #1e293b, #172133)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: '1.1rem' }}>
                    SKU: {forecast.stock_code}
                  </span>
                  {forecast.is_fallback ? (
                    <span className="badge badge-critical" title="Global Mean Fallback (FR-2.4)">
                      Level 0 Fallback
                    </span>
                  ) : (
                    <span className="badge badge-healthy" title="Trained Random Forest (RF-DEPTH-10)">
                      <CheckCircle2 size={12} />
                      {forecast.model_version}
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{forecast.product_name}</h3>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Forecast Horizon</div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#c084fc' }}>
                  <Calendar size={15} />
                  <span>Next 7 Days (Forward Window)</span>
                </div>
              </div>
            </div>

            {/* Prediction Highlight Numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.35rem' }}>Predicted 7-Day Demand</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#38bdf8' }}>
                  {forecast.predicted_demand_7day.toFixed(2)}
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: '#94a3b8', marginLeft: '0.35rem' }}>units</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  ~{(forecast.predicted_demand_7day / 7).toFixed(1)} units / day expected
                </div>
              </div>

              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.35rem' }}>Current Available Stock</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: forecast.available_stock > 10 ? '#34d399' : '#fbbf24' }}>
                  {forecast.available_stock}
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: '#94a3b8', marginLeft: '0.35rem' }}>units</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Physical: {forecast.current_stock} units
                </div>
              </div>

              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.35rem' }}>Historical Daily Average</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#e2e8f0' }}>
                  {forecast.average_daily_demand.toFixed(2)}
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: '#94a3b8', marginLeft: '0.35rem' }}>units</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Based on 1.46M transaction ledger
                </div>
              </div>

              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.35rem' }}>Selling Unit Price</div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#34d399' }}>
                  ₹{forecast.unit_price.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Forward valuation: ₹{(forecast.predicted_demand_7day * forecast.unit_price).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Fallback Notice if applicable */}
            {forecast.is_fallback && (
              <div className="alert-box warning">
                <ShieldAlert size={18} />
                <div>
                  <strong>Level 0 Heuristic Applied (FR-2.4):</strong> This SKU had sparse historical features, so the
                  global training mean constant of <strong>18.3150 units</strong> was assigned as an operational safety
                  estimate.
                </div>
              </div>
            )}

            {/* Recommendation Call to Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                Need to generate purchase orders based on this demand?
              </div>
              <button className="btn btn-primary" onClick={onNavigateToReorder}>
                <span>View Reorder Engine</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
