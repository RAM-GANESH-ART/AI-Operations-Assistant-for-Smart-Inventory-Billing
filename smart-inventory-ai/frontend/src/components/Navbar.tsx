import React from 'react';
import {
  BarChart3,
  Boxes,
  TrendingUp,
  RotateCcw,
  CreditCard,
  Receipt,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isBackendConnected: boolean;
  modelLoaded: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  isBackendConnected,
  modelLoaded,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'catalog', label: 'Product Catalog', icon: Boxes },
    { id: 'forecast', label: 'Demand Forecast', icon: TrendingUp },
    { id: 'reorder', label: 'Reorder Engine', icon: RotateCcw },
    { id: 'billing', label: 'POS Billing', icon: CreditCard },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
  ];

  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="nav-logo">
          <Sparkles size={22} />
        </div>
        <div>
          <h1 className="nav-title">SmartOps AI</h1>
          <p className="nav-subtitle">Kirana Inventory & POS Billing Assistant</p>
        </div>
      </div>

      <nav className="nav-tabs">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`nav-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => onSelectTab(t.id)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div
          className="nav-status"
          style={{
            background: isBackendConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: isBackendConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            color: isBackendConnected ? '#34d399' : '#f87171',
          }}
        >
          <span
            className="status-dot"
            style={{
              background: isBackendConnected ? '#10b981' : '#ef4444',
              boxShadow: isBackendConnected ? '0 0 8px #10b981' : '0 0 8px #ef4444',
            }}
          />
          {isBackendConnected ? (modelLoaded ? 'RF Model Active' : 'API Online') : 'API Offline'}
        </div>
      </div>
    </header>
  );
};
