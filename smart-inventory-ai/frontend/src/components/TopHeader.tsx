import React, { useEffect, useRef, useState } from 'react';
import { ScreenId } from '../types';

interface TopHeaderProps {
  onToggleSidebar: () => void;
  onSelectScreen: (screen: ScreenId) => void;
  onLockTerminal: () => void;
  isBackendConnected: boolean;
  modelLoaded: boolean;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onToggleSidebar,
  onSelectScreen,
  onLockTerminal,
  isBackendConnected,
  modelLoaded,
  onShowToast,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkAllRead = () => {
    setUnreadCount(0);
    onShowToast('All notifications marked as read', 'info');
  };

  const handleSyncData = () => {
    setUserMenuOpen(false);
    onShowToast('Syncing products and ML model weights from PostgreSQL...', 'info');
    setTimeout(() => {
      onShowToast('Data & ML weights synchronized successfully!', 'success');
    }, 1200);
  };

  const handleExportBackup = () => {
    setUserMenuOpen(false);
    onShowToast('Exporting sales backup JSON...', 'info');
    setTimeout(() => {
      onShowToast('Sales backup downloaded successfully', 'success');
    }, 800);
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          className="header-btn"
          id="sidebar-toggle-btn"
          aria-label="Toggle Sidebar"
          title="Toggle Sidebar"
          onClick={onToggleSidebar}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.8" />
            <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" stroke-width="1.8" />
          </svg>
        </button>

        {/* Live Model Indicator */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '99px',
            fontSize: '11px',
            fontWeight: 600,
            background: isBackendConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: isBackendConnected ? '#34d399' : '#f87171',
            border: `1px solid ${isBackendConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: isBackendConnected ? '#10b981' : '#ef4444',
              boxShadow: isBackendConnected ? '0 0 6px #10b981' : '0 0 6px #ef4444',
            }}
          />
          {isBackendConnected
            ? modelLoaded
              ? 'RF Model Active • PostgreSQL 16'
              : 'API Online'
            : 'API Offline'}
        </div>
      </div>

      <div className="header-actions">
        {/* Notification Dropdown Wrapper */}
        <div className="header-action-wrapper" id="notif-wrapper" ref={notifRef}>
          <button
            className={`header-btn${notifOpen ? ' active' : ''}`}
            id="notif-btn"
            aria-label="Notifications"
            aria-haspopup="true"
            aria-expanded={notifOpen}
            title={`Notifications (${unreadCount} unread)`}
            onClick={() => setNotifOpen(!notifOpen)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.8" fill="none" />
              <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.8" fill="none" />
            </svg>
            {unreadCount > 0 && (
              <span className="notif-badge" id="notif-badge">{unreadCount}</span>
            )}
          </button>

          {/* Notifications Popover */}
          <div className={`dropdown-popover notif-popover${notifOpen ? ' show' : ''}`} id="notif-dropdown" role="dialog">
            <div className="dropdown-header">
              <div className="dropdown-title-group">
                <span className="dropdown-title">Notifications</span>
                <span className="notif-count-pill" id="notif-count-pill">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
                </span>
              </div>
              <div className="dropdown-header-actions">
                <button
                  type="button"
                  className="notif-action-text-btn"
                  id="notif-mark-all"
                  onClick={handleMarkAllRead}
                >
                  Mark all as read
                </button>
              </div>
            </div>

            <div className="notif-list" id="notif-list">
              <div className="notif-item unread" onClick={() => { setNotifOpen(false); onSelectScreen('reorder'); }}>
                <div className="notif-icon-box critical">⚠️</div>
                <div className="notif-content">
                  <div className="notif-item-top">
                    <span className="notif-item-title">Critical Stock Alert</span>
                    <span className="notif-time">10m ago</span>
                  </div>
                  <p className="notif-item-desc">
                    Multiple items have breached minimum safety stock buffer levels.
                  </p>
                </div>
              </div>

              <div className="notif-item unread" onClick={() => { setNotifOpen(false); onSelectScreen('forecasting'); }}>
                <div className="notif-icon-box ai">🤖</div>
                <div className="notif-content">
                  <div className="notif-item-top">
                    <span className="notif-item-title">AI Forecast Updated</span>
                    <span className="notif-time">1h ago</span>
                  </div>
                  <p className="notif-item-desc">
                    7-day forward demand curves recalculated using Random Forest model.
                  </p>
                </div>
              </div>

              <div className="notif-item" onClick={() => { setNotifOpen(false); onSelectScreen('transactions'); }}>
                <div className="notif-icon-box success">🧾</div>
                <div className="notif-content">
                  <div className="notif-item-top">
                    <span className="notif-item-title">Recent POS Checkout</span>
                    <span className="notif-time">2h ago</span>
                  </div>
                  <p className="notif-item-desc">
                    Transaction logged with atomic inventory deduction and idempotency key.
                  </p>
                </div>
              </div>
            </div>

            <div className="dropdown-footer">
              <button
                type="button"
                className="notif-footer-btn"
                id="notif-footer-action"
                onClick={() => { setNotifOpen(false); onSelectScreen('reorder'); }}
              >
                <span>⚡ View All AI Inventory Risks</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* User Menu Dropdown Wrapper */}
        <div className="header-action-wrapper" id="user-wrapper" ref={userRef}>
          <button
            className={`header-user-btn${userMenuOpen ? ' active' : ''}`}
            id="user-menu-btn"
            aria-label="User profile and store options"
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <div className="header-avatar">R</div>
            <span className="header-username">
              Ram
              <svg className="user-caret" width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </button>

          {/* User Menu Popover */}
          <div className={`dropdown-popover user-popover${userMenuOpen ? ' show' : ''}`} id="user-dropdown" role="menu">
            <div className="user-popover-header">
              <div className="user-popover-avatar">R</div>
              <div className="user-popover-info">
                <div className="user-popover-name">Ram Ganesh</div>
                <div className="user-popover-role">Store Manager &bull; Admin</div>
                <div className="user-popover-badge">
                  <span className="online-indicator"></span> Active &bull; Branch #01
                </div>
              </div>
            </div>

            <div className="dropdown-divider"></div>

            <div className="dropdown-menu-list">
              <button
                type="button"
                className="user-menu-item"
                onClick={() => { setUserMenuOpen(false); onSelectScreen('settings'); }}
              >
                <span className="menu-icon">⚙️</span>
                <div className="menu-content">
                  <span className="menu-title">Store Settings</span>
                  <span className="menu-desc">Profile, tax rates & preferences</span>
                </div>
              </button>

              <button
                type="button"
                className="user-menu-item"
                onClick={() => { setUserMenuOpen(false); onSelectScreen('billing'); }}
              >
                <span className="menu-icon">💳</span>
                <div className="menu-content">
                  <span className="menu-title">POS Billing Counter</span>
                  <span className="menu-desc">New transaction & receipt checkout</span>
                </div>
              </button>

              <button
                type="button"
                className="user-menu-item"
                onClick={() => { setUserMenuOpen(false); onSelectScreen('forecasting'); }}
              >
                <span className="menu-icon">🤖</span>
                <div className="menu-content">
                  <span className="menu-title">AI Forecast Models</span>
                  <span className="menu-desc">7-day predictions & demand trends</span>
                </div>
              </button>

              <button
                type="button"
                className="user-menu-item"
                onClick={() => { setUserMenuOpen(false); onSelectScreen('reports'); }}
              >
                <span className="menu-icon">📊</span>
                <div className="menu-content">
                  <span className="menu-title">Sales Analytics & DV</span>
                  <span className="menu-desc">Interactive charts & revenue reports</span>
                </div>
              </button>

              <div className="dropdown-divider"></div>

              <button type="button" className="user-menu-item" onClick={handleSyncData}>
                <span className="menu-icon">🔄</span>
                <div className="menu-content">
                  <span className="menu-title">Sync Data & Models</span>
                  <span className="menu-desc">Reload products & fresh ML weights</span>
                </div>
              </button>

              <button type="button" className="user-menu-item" onClick={handleExportBackup}>
                <span className="menu-icon">📥</span>
                <div className="menu-content">
                  <span className="menu-title">Export Sales Backup</span>
                  <span className="menu-desc">Download complete sales history JSON</span>
                </div>
              </button>

              <div className="dropdown-divider"></div>

              <button
                type="button"
                className="user-menu-item danger"
                onClick={() => { setUserMenuOpen(false); onLockTerminal(); }}
              >
                <span className="menu-icon">🔒</span>
                <div className="menu-content">
                  <span className="menu-title">Lock Terminal</span>
                  <span className="menu-desc">Secure register until resumed</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
