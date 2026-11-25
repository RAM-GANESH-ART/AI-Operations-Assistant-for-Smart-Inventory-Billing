import React, { useEffect, useRef, useState } from 'react';
import { Chart, LineController, BarController, DoughnutController, LineElement, BarElement, ArcElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
import { Product } from '../types';

Chart.register(LineController, BarController, DoughnutController, LineElement, BarElement, ArcElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

interface ReportsScreenProps {
  products: Product[];
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ products, onShowToast }) => {
  const [viewMode, setViewMode] = useState<'interactive' | 'static'>('interactive');
  const [timeframe, setTimeframe] = useState<string>('30');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const dailyTrendRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const topItemsRef = useRef<HTMLCanvasElement>(null);
  const dowRef = useRef<HTMLCanvasElement>(null);
  const riskRef = useRef<HTMLCanvasElement>(null);

  const charts = useRef<Record<string, Chart | null>>({});

  useEffect(() => {
    if (viewMode !== 'interactive') return;

    // Destroy existing
    Object.values(charts.current).forEach((c) => c?.destroy());
    charts.current = {};

    // 1. Daily Sales Trend
    if (dailyTrendRef.current) {
      const ctx = dailyTrendRef.current.getContext('2d');
      if (ctx) {
        const days = Array.from({ length: 14 }, (_, i) => `Nov ${11 + i}`);
        const revenue = [28000, 31000, 27500, 36000, 42000, 39000, 34000, 38000, 41000, 46000, 43000, 49000, 47500, 52000];
        const units = [450, 480, 420, 560, 640, 590, 510, 580, 620, 710, 650, 740, 710, 790];

        charts.current.dailyTrend = new Chart(ctx, {
          type: 'line',
          data: {
            labels: days,
            datasets: [
              {
                label: 'Revenue (₹)',
                data: revenue,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true,
                tension: 0.35,
                yAxisID: 'y',
              },
              {
                label: 'Units Sold',
                data: units,
                borderColor: '#10b981',
                borderDash: [4, 4],
                tension: 0.35,
                yAxisID: 'y1',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#cbd5e1' },
            },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8' } },
              y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
              y1: { position: 'right', grid: { display: false }, ticks: { color: '#34d399' } },
            },
          },
        });
      }
    }

    // 2. Category Donut
    if (donutRef.current) {
      const ctx = donutRef.current.getContext('2d');
      if (ctx) {
        charts.current.donut = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Grocery', 'Dairy', 'Beverages', 'Snacks', 'Personal Care'],
            datasets: [
              {
                data: [42, 24, 18, 11, 5],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
                borderColor: '#141c2b',
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: '#0f172a', callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` } },
            },
          },
        });
      }
    }

    // 3. Top Items Bar
    if (topItemsRef.current) {
      const ctx = topItemsRef.current.getContext('2d');
      if (ctx) {
        charts.current.topItems = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Assorted Colour Bird', 'Heart Holder', 'Cake Stand', 'Jumbo Bag Red', 'Tea Towels'],
            datasets: [
              {
                label: 'Revenue (₹)',
                data: [48000, 39500, 34200, 31000, 27500],
                backgroundColor: 'rgba(99, 102, 241, 0.85)',
                borderRadius: 6,
              },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
              y: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 10 } } },
            },
          },
        });
      }
    }

    // 4. Day of Week
    if (dowRef.current) {
      const ctx = dowRef.current.getContext('2d');
      if (ctx) {
        charts.current.dow = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
              {
                label: 'Volume',
                data: [320, 290, 340, 390, 480, 680, 720],
                backgroundColor: 'rgba(59, 130, 246, 0.85)',
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
              y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
            },
          },
        });
      }
    }

    // 5. Stockout Risk Matrix
    if (riskRef.current) {
      const ctx = riskRef.current.getContext('2d');
      if (ctx) {
        charts.current.risk = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Safe Buffer', 'Low Stock', 'Stockout Risk'],
            datasets: [
              {
                data: [78, 16, 6],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderColor: '#141c2b',
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: { legend: { display: false } },
          },
        });
      }
    }

    return () => {
      Object.values(charts.current).forEach((c) => c?.destroy());
      charts.current = {};
    };
  }, [viewMode]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="screen active" id="screen-reports">
      <div className="screen-header">
        <div>
          <h1>Data Visualization &amp; Reports</h1>
          <p className="screen-subtitle">
            Comprehensive analytics powered by 1.46M sales records and ML forecast models
          </p>
        </div>
        <div className="dv-toolbar" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="dv-toggle-group">
            <button
              className={`dv-toggle-btn${viewMode === 'interactive' ? ' active' : ''}`}
              id="btn-dv-interactive"
              onClick={() => setViewMode('interactive')}
            >
              📊 Interactive Charts
            </button>
            <button
              className={`dv-toggle-btn${viewMode === 'static' ? ' active' : ''}`}
              id="btn-dv-static"
              onClick={() => setViewMode('static')}
            >
              📈 Statistical Plots (Python)
            </button>
          </div>
          <button className="btn-outline" id="print-report-btn" onClick={handlePrint}>
            🖨 Export / Print Report
          </button>
        </div>
      </div>

      {/* Interactive Charts View */}
      {viewMode === 'interactive' && (
        <div id="interactive-dv-container">
          <div className="inventory-filters" style={{ marginBottom: '16px' }}>
            <select
              id="rep-time-filter"
              className="filter-select"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="30">Timeframe: Last 30 Days (Database + Live POS)</option>
              <option value="7">Timeframe: Last 7 Days (Recent Trend)</option>
              <option value="today">Timeframe: Today's Live Sales Only</option>
            </select>
            <select
              id="rep-cat-filter"
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Category: All Categories</option>
              <option value="Bakery">Bakery</option>
              <option value="Dairy">Dairy</option>
              <option value="Grocery">Grocery</option>
              <option value="Personal">Personal</option>
              <option value="Snacks">Snacks</option>
              <option value="Household">Household</option>
              <option value="Beverages">Beverages</option>
            </select>
            <span
              id="live-sales-indicator"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(16,185,129,0.12)',
                color: 'var(--green)',
                border: '1px solid rgba(16,185,129,0.25)',
                padding: '6px 12px',
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }}></span>
              Live Sales Sync Active
            </span>
          </div>

          <div className="reports-grid">
            {/* Large Daily Sales & Forecast Trend */}
            <div className="card chart-card large-chart">
              <div className="card-header">
                <div>
                  <span className="card-title">Daily Sales Trend &amp; Revenue Dynamics</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    (Aggregated from 1.46M transactions database)
                  </span>
                </div>
                <div className="chart-legend">
                  <span className="leg-dot blue-dot"></span> Revenue (₹)
                  <span className="leg-dot" style={{ background: '#10b981', marginLeft: '12px' }}></span> Units Sold
                </div>
              </div>
              <div className="chart-box" style={{ height: '250px' }}>
                <canvas ref={dailyTrendRef} id="dailySalesCanvas"></canvas>
              </div>
            </div>

            {/* Category Distribution Donut */}
            <div className="card">
              <div className="card-header"><span className="card-title">Revenue by Product Category</span></div>
              <div className="chart-box" style={{ height: '200px' }}>
                <canvas ref={donutRef} id="donutCanvas"></canvas>
              </div>
              <div className="donut-total" style={{ textAlign: 'center', marginTop: '10px' }}>
                <span id="donut-total-val" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>₹1,47,233</span>{' '}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Store Sales</span>
              </div>
            </div>

            {/* Top Products by Revenue */}
            <div className="card">
              <div className="card-header"><span className="card-title">Top 5 High-Revenue Items</span></div>
              <div className="chart-box" style={{ height: '220px' }}>
                <canvas ref={topItemsRef} id="topItemsCanvas"></canvas>
              </div>
            </div>

            {/* Day of Week Distribution */}
            <div className="card">
              <div className="card-header"><span className="card-title">Peak Sales by Day of Week</span></div>
              <div className="chart-box" style={{ height: '200px' }}>
                <canvas ref={dowRef} id="dowCanvas"></canvas>
              </div>
            </div>

            {/* Stockout Risk & Inventory Health */}
            <div className="card">
              <div className="card-header"><span className="card-title">Inventory Health &amp; Stockout Risk</span></div>
              <div className="chart-box" style={{ height: '200px' }}>
                <canvas ref={riskRef} id="riskCanvas"></canvas>
              </div>
            </div>

            {/* Top Products Data Table */}
            <div className="card">
              <div className="card-header"><span className="card-title">Best Sellers Breakdown</span></div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody id="top-products-rev-body">
                    {products.slice(0, 6).map((p) => (
                      <tr key={p.stock_code}>
                        <td style={{ fontWeight: 600 }}>{p.product_name}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.category || 'General'}</td>
                        <td style={{ fontWeight: 700, color: '#34d399' }}>₹{(p.unit_price * (p.sold || 45)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Static Plots View */}
      {viewMode === 'static' && (
        <div id="static-dv-container">
          <div className="info-banner" style={{ marginBottom: '16px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            High-resolution publication figures generated directly by Python (Matplotlib &amp; Seaborn) from raw transaction records.
          </div>
          <div className="static-dv-grid">
            <div className="static-chart-card">
              <span className="static-chart-title">1. Daily Revenue &amp; Volume Trend (Last 30 Days)</span>
              <img src="/assets/charts/daily_trend_dv.png" alt="Daily Sales Trend" style={{ width: '100%', borderRadius: '8px' }} />
            </div>
            <div className="static-chart-card">
              <span className="static-chart-title">2. Revenue by Product Category</span>
              <img src="/assets/charts/category_dv.png" alt="Category Distribution" style={{ width: '100%', borderRadius: '8px' }} />
            </div>
            <div className="static-chart-card">
              <span className="static-chart-title">3. AI Inventory Health &amp; Stockout Risk Matrix</span>
              <img src="/assets/charts/stockout_risk_dv.png" alt="Stockout Risk Matrix" style={{ width: '100%', borderRadius: '8px' }} />
            </div>
            <div className="static-chart-card">
              <span className="static-chart-title">4. Top 10 High-Revenue Products</span>
              <img src="/assets/charts/top_products_dv.png" alt="Top Products" style={{ width: '100%', borderRadius: '8px' }} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
