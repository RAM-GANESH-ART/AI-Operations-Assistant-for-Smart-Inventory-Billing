import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Catalog } from './components/Catalog';
import { ForecastView } from './components/ForecastView';
import { ReorderView } from './components/ReorderView';
import { BillingTerminal } from './components/BillingTerminal';
import { InvoiceHistory } from './components/InvoiceHistory';
import { api } from './services/api';
import { CartItem, Product } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Cross-screen state: Forecast SKU selected from Catalog/Alerts
  const [selectedForecastSku, setSelectedForecastSku] = useState<string>('10002');

  // Shared shopping cart state across screens
  const [cart, setCart] = useState<CartItem[]>([]);

  // Health check on initial load & periodic ping
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await api.getHealth();
        setIsBackendConnected(health.status === 'running');
        setModelLoaded(health.model_loaded);
      } catch {
        setIsBackendConnected(false);
        setModelLoaded(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigateToForecast = (sku: string) => {
    setSelectedForecastSku(sku);
    setActiveTab('forecast');
  };

  const handleAddToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.stock_code === product.stock_code);
      if (existing) {
        const newQty = Math.min(product.available_stock, existing.quantity + quantity);
        return prev.map((item) =>
          item.stock_code === product.stock_code
            ? { ...item, quantity: newQty, line_total: newQty * item.unit_price }
            : item
        );
      } else {
        const newQty = Math.min(product.available_stock, quantity);
        return [
          ...prev,
          {
            stock_code: product.stock_code,
            product_name: product.product_name,
            unit_price: product.unit_price,
            quantity: newQty,
            available_stock: product.available_stock,
            line_total: newQty * product.unit_price,
          },
        ];
      }
    });
  };

  const handleUpdateCartQuantity = (stockCode: string, qty: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.stock_code === stockCode
          ? {
              ...item,
              quantity: Math.min(item.available_stock, qty),
              line_total: Math.min(item.available_stock, qty) * item.unit_price,
            }
          : item
      )
    );
  };

  const handleRemoveFromCart = (stockCode: string) => {
    setCart((prev) => prev.filter((item) => item.stock_code !== stockCode));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Screen title/subtitle map
  const screenMeta: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Store Operations Dashboard', subtitle: 'Real-time inventory valuation, stock health & predictive demand KPIs' },
    catalog:   { title: 'Product Catalog', subtitle: 'Browse, search, and manage all SKUs in your inventory' },
    forecast:  { title: 'Demand Forecast', subtitle: 'AI-powered 7-day demand predictions using Random Forest ML model' },
    reorder:   { title: 'Reorder Engine', subtitle: 'Smart replenishment recommendations with owner override controls' },
    billing:   { title: 'POS Billing Terminal', subtitle: 'Atomic checkout with PostgreSQL row-locking & Idempotency-Key safety' },
    invoices:  { title: 'Invoice History', subtitle: 'Full transaction ledger with receipt viewer and payment breakdown' },
  };

  const meta = screenMeta[activeTab] || { title: 'SmartOps AI', subtitle: '' };

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        cartCount={cart.length}
      />

      <div className="main-content">
        {/* Top Header Bar */}
        <header className="top-header">
          <div className="header-left">
            <div>
              <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {meta.title}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {meta.subtitle}
              </p>
            </div>
          </div>

          <div className="header-actions">
            <div className={`status-pill ${isBackendConnected ? 'online' : 'offline'}`}>
              <span className={`status-dot ${isBackendConnected ? 'green' : 'red'}`} />
              {isBackendConnected ? (modelLoaded ? 'RF Model Active' : 'API Online') : 'API Offline'}
            </div>
          </div>
        </header>

        {/* Screen Content */}
        <div className="screens-container">
          {activeTab === 'dashboard' && (
            <div className="screen">
              <Dashboard
                onNavigateToCatalog={() => setActiveTab('catalog')}
                onNavigateToForecast={handleNavigateToForecast}
                onNavigateToReorder={() => setActiveTab('reorder')}
              />
            </div>
          )}

          {activeTab === 'catalog' && (
            <div className="screen">
              <Catalog
                onNavigateToForecast={handleNavigateToForecast}
                onAddToCart={handleAddToCart}
              />
            </div>
          )}

          {activeTab === 'forecast' && (
            <div className="screen">
              <ForecastView
                initialStockCode={selectedForecastSku}
                onNavigateToReorder={() => setActiveTab('reorder')}
              />
            </div>
          )}

          {activeTab === 'reorder' && (
            <div className="screen">
              <ReorderView onNavigateToForecast={handleNavigateToForecast} />
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="screen">
              <BillingTerminal
                cart={cart}
                onUpdateCartQuantity={handleUpdateCartQuantity}
                onRemoveFromCart={handleRemoveFromCart}
                onClearCart={handleClearCart}
                onAddToCart={handleAddToCart}
              />
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="screen">
              <InvoiceHistory />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
