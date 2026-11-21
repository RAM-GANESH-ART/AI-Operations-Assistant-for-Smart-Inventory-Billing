import React from 'react';
import {
  BarChart3,
  Boxes,
  TrendingUp,
  RotateCcw,
  CreditCard,
  Receipt,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  cartCount: number;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',      icon: BarChart3  },
  { id: 'catalog',   label: 'Product Catalog', icon: Boxes      },
  { id: 'forecast',  label: 'Demand Forecast', icon: TrendingUp },
  { id: 'reorder',   label: 'Reorder Engine',  icon: RotateCcw  },
  { id: 'billing',   label: 'POS Billing',     icon: CreditCard },
  { id: 'invoices',  label: 'Invoices',        icon: Receipt    },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  cartCount,
}) => {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Zap size={18} />
        </div>
        {!collapsed && (
          <span className="logo-text">
            Smart<span className="logo-ai">Ops AI</span>
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item${activeTab === id ? ' active' : ''}`}
            onClick={() => onSelectTab(id)}
            title={collapsed ? label : undefined}
          >
            <Icon size={16} />
            {!collapsed && (
              <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {label}
                {id === 'billing' && cartCount > 0 && (
                  <span
                    style={{
                      background: 'var(--blue)',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '99px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                    }}
                  >
                    {cartCount}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* User Info */}
      <div className="sidebar-user">
        <div className="user-avatar">R</div>
        {!collapsed && (
          <div className="user-info">
            <span className="user-name">Ram Ganesh</span>
            <span className="user-role">Store Manager • Admin</span>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        className="sidebar-collapse-btn"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{ bottom: '80px', top: 'auto', transform: 'none' }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
};
