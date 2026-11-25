import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { LockModal } from './components/LockModal';
import { BillModal } from './components/BillModal';
import { Toast, ToastMessage } from './components/Toast';

import { DashboardScreen } from './components/DashboardScreen';
import { BillingScreen } from './components/BillingScreen';
import { TransactionsScreen } from './components/TransactionsScreen';
import { InventoryScreen } from './components/InventoryScreen';
import { ForecastingScreen } from './components/ForecastingScreen';
import { ReorderScreen } from './components/ReorderScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { ActivityScreen } from './components/ActivityScreen';
import { SettingsScreen } from './components/SettingsScreen';

import { api } from './services/api';
import { CartItem, InvoiceReceipt, Product, ScreenId } from './types';

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<InvoiceReceipt | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedForecastSku, setSelectedForecastSku] = useState<string>('10002');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);

  const showToast = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = `t-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Health check & products load
  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const health = await api.getHealth();
        if (isMounted) {
          setIsBackendConnected(health.status === 'running');
          setModelLoaded(health.model_loaded);
        }
      } catch {
        if (isMounted) {
          setIsBackendConnected(false);
          setModelLoaded(false);
        }
      }
    };

    const loadProducts = async () => {
      try {
        const res = await api.getProducts({ page_size: 100 });
        if (isMounted && res.products) {
          setProducts(res.products);
          if (res.products.length > 0 && !selectedForecastSku) {
            setSelectedForecastSku(res.products[0].stock_code);
          }
        }
      } catch (err) {
        console.error('Failed to load initial product catalog', err);
      }
    };

    checkHealth();
    loadProducts();

    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

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

  const handleUpdateCartQty = (stockCode: string, qty: number) => {
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
    showToast('Item removed from cart', 'info');
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleNavigateToForecast = (sku: string) => {
    setSelectedForecastSku(sku);
    setActiveScreen('forecasting');
  };

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Prototype Sidebar */}
      <Sidebar
        activeScreen={activeScreen}
        onSelectScreen={setActiveScreen}
        collapsed={sidebarCollapsed}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Prototype Top Header */}
        <TopHeader
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onSelectScreen={setActiveScreen}
          onLockTerminal={() => setIsLocked(true)}
          isBackendConnected={isBackendConnected}
          modelLoaded={modelLoaded}
          onShowToast={showToast}
        />

        {/* 9 Prototype Screens */}
        <div className="screens-container">
          {activeScreen === 'dashboard' && (
            <DashboardScreen onNavigate={setActiveScreen} />
          )}

          {activeScreen === 'billing' && (
            <BillingScreen
              products={products}
              cart={cart}
              onAddToCart={handleAddToCart}
              onUpdateCartQty={handleUpdateCartQty}
              onRemoveFromCart={handleRemoveFromCart}
              onClearCart={handleClearCart}
              onReceiptCreated={(r) => setActiveReceipt(r)}
              onShowToast={showToast}
            />
          )}

          {activeScreen === 'transactions' && (
            <TransactionsScreen
              onNavigate={setActiveScreen}
              onViewReceipt={(r) => setActiveReceipt(r)}
              onShowToast={showToast}
            />
          )}

          {activeScreen === 'inventory' && (
            <InventoryScreen
              products={products}
              onNavigateToForecast={handleNavigateToForecast}
              onAddToCart={(p) => {
                handleAddToCart(p, 1);
                showToast(`Added ${p.product_name} to cart`, 'success');
              }}
              onShowToast={showToast}
            />
          )}

          {activeScreen === 'forecasting' && (
            <ForecastingScreen
              products={products}
              selectedSku={selectedForecastSku}
              onSelectSku={setSelectedForecastSku}
              onShowToast={showToast}
            />
          )}

          {activeScreen === 'reorder' && (
            <ReorderScreen
              onNavigateToForecast={handleNavigateToForecast}
              onShowToast={showToast}
            />
          )}

          {activeScreen === 'reports' && (
            <ReportsScreen
              products={products}
              onShowToast={showToast}
            />
          )}

          {activeScreen === 'activity' && (
            <ActivityScreen onShowToast={showToast} />
          )}

          {activeScreen === 'settings' && (
            <SettingsScreen onShowToast={showToast} />
          )}
        </div>
      </main>

      {/* Global Bill / Receipt Modal */}
      <BillModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
        onNewOrder={() => {
          setActiveReceipt(null);
          setActiveScreen('billing');
        }}
      />

      {/* Terminal Lock Screen Modal */}
      <LockModal
        isOpen={isLocked}
        onResume={() => {
          setIsLocked(false);
          showToast('Session unlocked', 'success');
        }}
      />

      {/* Toast Notification Container */}
      <Toast toasts={toasts} />
    </div>
  );
}

export default App;
