import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardResponse } from '../types';

// Chart.js imports
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  DoughnutController,
  ArcElement,
  Legend,
} from 'chart.js';

Chart.register(
  LineController, LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, DoughnutController, ArcElement, Legend
);

interface DashboardProps {
  onNavigateToCatalog: () => void;
  onNavigateToForecast: (stockCode: string) => void;
  onNavigateToReorder: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToCatalog,
  onNavigateToForecast,
  onNavigateToReorder,
}) => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const donutRef = useRef<HTMLCanvasElement>(null);
  const donutChart = useRef<Chart | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboardSummary();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Build donut chart when data arrives
  useEffect(() => {
    if (!data || !donutRef.current) return;

    const { summary } = data;

    if (donutChart.current) {
      donutChart.current.destroy();
      donutChart.current = null;
    }

    donutChart.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Healthy', 'Low Stock', 'Critical', 'Out of Stock'],
        datasets: [{
          data: [
            summary.healthy_stock_count,
            summary.low_stock_count,
            summary.critical_stock_count,
            summary.out_of_stock_count,
          ],
          backgroundColor: [
            'rgba(16,185,129,0.85)',
            'rgba(59,130,246,0.85)',
            'rgba(245,158,11,0.85)',
            'rgba(239,68,68,0.85)',
          ],
          borderColor: '#0d1117',
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed} SKUs`,
            },
          },
        },
      },
    });

    return () => {
      donutChart.current?.destroy();
      donutChart.current = null;
    };
  }, [data]);

  if (loading) {
    return (
      <div className="loading-center">
        <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--blue)' }} />
        <p>Loading real-time store metrics from PostgreSQL...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="alert-box danger">
        <AlertTriangle size={18} />
        <div>
          <strong>Connection Error</strong><br />
          {error || 'Could not fetch dashboard summary from backend.'}
          <br />
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }} onClick={fetchSummary}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { summary, top_alerts } = data;

  const totalStockStatuses =
    summary.healthy_stock_count +
    summary.low_stock_count +
    summary.critical_stock_count +
    summary.out_of_stock_count;

  const pct = (n: number) =>
    totalStockStatuses ? Math.round((n / totalStockStatuses) * 100) : 0;

  return (
    <div>
      {/* KPI Row */}
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card" onClick={onNavigateToCatalog}>
          <div className="kpi-top">
            <span className="kpi-label">Inventory Value</span>
            <div className="kpi-icon blue"><DollarSign size={16} /></div>
          </div>
          <div>
            <div className="kpi-value">
              ₹{summary.total_inventory_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="kpi-sub">{summary.total_inventory_units.toLocaleString()} total units</div>
          </div>
        </div>

        <div className="kpi-card" onClick={onNavigateToCatalog}>
          <div className="kpi-top">
            <span className="kpi-label">Active SKUs</span>
            <div className="kpi-icon green"><Boxes size={16} /></div>
          </div>
          <div>
            <div className="kpi-value">{summary.total_products.toLocaleString()}</div>
            <div className="kpi-sub">{summary.active_products.toLocaleString()} enabled in catalog</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Revenue</span>
            <div className="kpi-icon purple"><TrendingUp size={16} /></div>
          </div>
          <div>
            <div className="kpi-value">
              ₹{summary.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="kpi-sub">{summary.total_invoices} invoices issued</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Sales Records</span>
            <div className="kpi-icon amber"><Layers size={16} /></div>
          </div>
          <div>
            <div className="kpi-value">{summary.daily_sales_records.toLocaleString()}</div>
            <div className="kpi-sub">Aggregated daily ledger rows</div>
          </div>
        </div>
      </div>

      {/* Charts & Alerts Grid */}
      <div className="dashboard-grid">
        {/* Stock Health Donut */}
        <div className="min-chart-card">
          <div className="min-chart-header">
            <span className="min-chart-title">
              <CheckCircle2 size={15} style={{ color: 'var(--green)', marginRight: '6px', verticalAlign: 'middle' }} />
              Stock Health Distribution
            </span>
            <span className="min-pill-badge">LIVE</span>
          </div>

          <div className="min-donut-body" style={{ position: 'relative', height: '180px' }}>
            <canvas ref={donutRef} />
          </div>

          <div className="min-category-legend">
            <span className="min-leg-item"><span className="min-leg-dot" style={{ background: '#10b981' }} />Healthy ({summary.healthy_stock_count})</span>
            <span className="min-leg-item"><span className="min-leg-dot" style={{ background: '#3b82f6' }} />Low ({summary.low_stock_count})</span>
            <span className="min-leg-item"><span className="min-leg-dot" style={{ background: '#f59e0b' }} />Critical ({summary.critical_stock_count})</span>
            <span className="min-leg-item"><span className="min-leg-dot" style={{ background: '#ef4444' }} />Out ({summary.out_of_stock_count})</span>
          </div>

          {/* Health bars */}
          <div className="health-bar-row" style={{ marginTop: '18px' }}>
            {[
              { label: 'Healthy Stock', count: summary.healthy_stock_count, cls: 'green', color: '#34d399' },
              { label: 'Low Stock', count: summary.low_stock_count, cls: 'blue', color: '#60a5fa' },
              { label: 'Critical Stock', count: summary.critical_stock_count, cls: 'amber', color: '#fbbf24' },
              { label: 'Out of Stock', count: summary.out_of_stock_count, cls: 'red', color: '#f87171' },
            ].map(({ label, count, cls, color }) => (
              <div key={label} className="health-bar-item">
                <div className="health-bar-top">
                  <span className="health-bar-label">{label}</span>
                  <span className="health-bar-count" style={{ color }}>{count} SKUs</span>
                </div>
                <div className="health-bar-track">
                  <div className={`health-bar-fill ${cls}`} style={{ width: `${pct(count)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onNavigateToCatalog}>Browse Catalog</button>
            <button className="btn btn-primary btn-sm" onClick={onNavigateToReorder}>Reorder View</button>
          </div>
        </div>

        {/* Priority Alerts */}
        <div className="min-chart-card">
          <div className="min-chart-header">
            <span className="min-chart-title">
              <AlertTriangle size={15} style={{ color: 'var(--orange)', marginRight: '6px', verticalAlign: 'middle' }} />
              Active Inventory Alerts
            </span>
            <span className="min-pill-badge" style={{ color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' }}>
              {top_alerts.length} URGENT
            </span>
          </div>

          {top_alerts.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={32} style={{ color: 'var(--green)', opacity: 1 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>All inventory levels healthy!</p>
            </div>
          ) : (
            <div className="alert-list">
              {top_alerts.slice(0, 5).map((alert) => (
                <div key={alert.stock_code} className="alert-item">
                  <span className={`alert-dot ${alert.available_stock === 0 ? 'red' : 'orange'}`} />
                  <div className="alert-text">
                    <div className="alert-name">{alert.product_name}</div>
                    <div className="alert-desc">
                      SKU: <span style={{ color: 'var(--blue)', fontFamily: 'monospace' }}>{alert.stock_code}</span>
                      {' · '}Stock: <strong style={{ color: alert.available_stock === 0 ? '#f87171' : '#fbbf24' }}>{alert.available_stock}</strong>
                      {' '}/ Min: {alert.minimum_stock}
                    </div>
                  </div>
                  <span className={alert.available_stock === 0 ? 'alert-tag critical-tag' : 'alert-tag warning-tag'}>
                    {alert.available_stock === 0 ? 'OUT' : 'CRITICAL'}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigateToForecast(alert.stock_code)}
                    style={{ marginLeft: '6px', flexShrink: 0 }}
                  >
                    <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
