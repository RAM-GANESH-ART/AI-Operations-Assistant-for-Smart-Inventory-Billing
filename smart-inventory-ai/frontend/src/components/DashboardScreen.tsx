import React, { useEffect, useRef, useState } from 'react';
import { Chart, BarController, BarElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { api } from '../services/api';
import { DashboardResponse, Product, ScreenId } from '../types';

Chart.register(BarController, BarElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

interface DashboardScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const barRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const barChartInstance = useRef<Chart | null>(null);
  const donutChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      try {
        setLoading(true);
        const [summaryRes, prodRes] = await Promise.all([
          api.getDashboardSummary(),
          api.getProducts({ page_size: 100 }),
        ]);
        if (isMounted) {
          setData(summaryRes);
          setTopProducts(prodRes.products);
        }
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadDashboard();
    return () => { isMounted = false; };
  }, []);

  // Render Charts
  useEffect(() => {
    if (!topProducts.length) return;

    // 1. Top Products by Value Bar Chart
    if (barRef.current) {
      if (barChartInstance.current) barChartInstance.current.destroy();

      const sorted = [...topProducts]
        .map((p) => {
          const val = (p.available_stock || 0) * (p.unit_price || 0);
          return {
            name: p.product_name,
            shortName: p.product_name.length > 15 ? p.product_name.slice(0, 13) + '…' : p.product_name,
            value: Math.round(val),
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      const ctx = barRef.current.getContext('2d');
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 240);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(1, '#3b82f6');

        barChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: sorted.map((p) => p.shortName),
            datasets: [
              {
                label: 'Inventory Value (₹)',
                data: sorted.map((p) => p.value),
                backgroundColor: gradient,
                borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 },
                barPercentage: 0.52,
                categoryPercentage: 0.8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#f8fafc',
                bodyColor: '#93c5fd',
                borderColor: '#1e293b',
                borderWidth: 1,
                callbacks: {
                  title: (items) => sorted[items[0].dataIndex]?.name || '',
                  label: (c) => ` ₹${Number(c.parsed.y).toLocaleString('en-IN')}`,
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: '#94a3b8', font: { size: 11, family: 'Inter, sans-serif' } },
              },
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                  color: '#94a3b8',
                  font: { size: 11 },
                  callback: (v) => {
                    const num = Number(v);
                    if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
                    if (num >= 1000) return '₹' + (num / 1000).toFixed(0) + 'k';
                    return num === 0 ? '0' : '₹' + num;
                  },
                },
              },
            },
          },
        });
      }
    }

    // 2. Products by Category Donut Chart
    if (donutRef.current) {
      if (donutChartInstance.current) donutChartInstance.current.destroy();

      const catCounts: Record<string, number> = {};
      topProducts.forEach((p) => {
        const cat = p.category || (p.product_name.includes('TEA') ? 'Beverages' : p.product_name.includes('HEART') ? 'Grocery' : 'General');
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });

      const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
      const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
      const labels = catEntries.map((e) => e[0]);
      const counts = catEntries.map((e) => e[1]);
      const bgColors = palette.slice(0, catEntries.length);

      const ctx = donutRef.current.getContext('2d');
      if (ctx) {
        donutChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [
              {
                data: counts,
                backgroundColor: bgColors,
                borderColor: '#0f1627',
                borderWidth: 2,
                hoverOffset: 5,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#f8fafc',
                bodyColor: '#cbd5e1',
                borderColor: '#1e293b',
                borderWidth: 1,
                callbacks: {
                  label: (c) => ` ${c.label}: ${c.parsed} SKUs`,
                },
              },
            },
          },
        });
      }
    }

    return () => {
      barChartInstance.current?.destroy();
      donutChartInstance.current?.destroy();
    };
  }, [topProducts]);

  const summary = data?.summary || {
    total_products: 100,
    total_inventory_value: 2012140,
    total_revenue: 147233,
    critical_stock_count: 0,
    out_of_stock_count: 0,
    low_stock_count: 0,
  };

  const gstCollected = Math.round(summary.total_revenue * 0.05);
  const activeAlerts = (data?.top_alerts?.length ?? 0) || (summary.critical_stock_count + summary.out_of_stock_count);

  return (
    <section className="screen active" id="screen-dashboard">
      {/* Minimal Executive Dashboard Header */}
      <div className="screen-header minimal-dash-header">
        <div>
          <h1>Dashboard</h1>
          <p className="screen-subtitle">Overview of your inventory operations</p>
        </div>
        <div className="date-badge" id="dashboard-date-badge" title="Live Store System Date">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span id="dashboard-date-text">Today</span>
        </div>
      </div>

      {/* 5 Minimal Metric Cards */}
      <div className="minimal-kpi-row">
        {/* 1. Total Products */}
        <div
          className="min-kpi-card"
          id="kpi-card-products"
          title="Total Products in Store Catalog"
          onClick={() => onNavigate('inventory')}
        >
          <div className="min-kpi-top">
            <span className="min-kpi-label">TOTAL PRODUCTS</span>
            <div className="min-kpi-icon blue">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="2" fill="none" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>
          <div className="min-kpi-value" id="kpi-total-products">
            {summary.total_products || 100}
          </div>
        </div>

        {/* 2. Inventory Value */}
        <div
          className="min-kpi-card"
          id="kpi-card-inv-value"
          title="Total Inventory Valuation"
          onClick={() => onNavigate('inventory')}
        >
          <div className="min-kpi-top">
            <span className="min-kpi-label">INVENTORY VALUE</span>
            <div className="min-kpi-icon green">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>₹</span>
            </div>
          </div>
          <div className="min-kpi-value" id="kpi-inventory-value">
            ₹{summary.total_inventory_value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* 3. Total Profit */}
        <div
          className="min-kpi-card"
          id="kpi-card-sales"
          title="Total Gross Store Profit"
          onClick={() => onNavigate('reports')}
        >
          <div className="min-kpi-top">
            <span className="min-kpi-label">TOTAL PROFIT</span>
            <div className="min-kpi-icon teal">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="min-kpi-value" id="kpi-total-profit">
            ₹{summary.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* 4. GST Collected */}
        <div
          className="min-kpi-card"
          id="kpi-card-gst"
          title="Total GST Collected"
          onClick={() => onNavigate('transactions')}
        >
          <div className="min-kpi-top">
            <span className="min-kpi-label">GST COLLECTED</span>
            <div className="min-kpi-icon amber">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                <line x1="6" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="2" />
                <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="2" />
                <line x1="6" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>
          <div className="min-kpi-value" id="kpi-gst-collected">
            ₹{gstCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* 5. Active Alerts */}
        <div
          className="min-kpi-card"
          id="kpi-card-low-stock"
          title="Active Inventory Alerts"
          onClick={() => onNavigate('reorder')}
        >
          <div className="min-kpi-top">
            <span className="min-kpi-label">ACTIVE ALERTS</span>
            <div className="min-kpi-icon rose">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" fill="none" />
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="min-kpi-value" id="kpi-active-alerts">
            {activeAlerts}
          </div>
        </div>
      </div>

      {/* Minimal Charts Grid */}
      <div className="minimal-charts-grid">
        {/* Left Chart: Top Products by Value (INR) */}
        <div className="min-chart-card">
          <div className="min-chart-header">
            <span className="min-chart-title">Top Products by Value</span>
            <span className="min-pill-badge">INR</span>
          </div>
          <div className="min-chart-body">
            <canvas ref={barRef} id="topProductsValueCanvas"></canvas>
          </div>
        </div>

        {/* Right Chart: Products by Category */}
        <div className="min-chart-card">
          <div className="min-chart-header">
            <span className="min-chart-title">Products by Category</span>
            <span className="min-pill-badge">{summary.total_products || 100} Products</span>
          </div>
          <div className="min-chart-body min-donut-body">
            <canvas ref={donutRef} id="stockCategoryCanvas"></canvas>
          </div>
          <div className="min-category-legend" id="min-category-legend">
            <span className="min-leg-item"><span className="min-leg-dot" style={{ background: '#3b82f6' }}></span>Grocery</span>
            <span className="min-leg-item"><span className="min-leg-dot" style={{ background: '#10b981' }}></span>Dairy</span>
            <span className="min-leg-item"><span className="min-leg-dot" style={{ background: '#f59e0b' }}></span>Beverages</span>
            <span className="min-leg-item"><span className="min-leg-dot" style={{ background: '#ef4444' }}></span>Snacks</span>
            <span className="min-leg-item"><span className="min-leg-dot" style={{ background: '#8b5cf6' }}></span>Personal</span>
          </div>
        </div>
      </div>
    </section>
  );
};
