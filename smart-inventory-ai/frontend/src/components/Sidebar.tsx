import React from 'react';
import { ScreenId } from '../types';

interface SidebarProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  collapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeScreen,
  onSelectScreen,
}) => {
  return (
    <aside className="sidebar" id="sidebar">
      {/* Sidebar Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" fill="currentColor" opacity=".3" />
            <path d="M5 5h3v3H5zM16 5h3v3h-3zM16 16h3v3h-3zM5 16h3v3H5z" fill="currentColor" />
          </svg>
        </div>
        <span className="logo-text">
          SmartStock <span className="logo-ai">AI</span>
        </span>
      </div>

      {/* 9 Sidebar Nav Links */}
      <nav className="sidebar-nav">
        <a
          className={`nav-item${activeScreen === 'dashboard' ? ' active' : ''}`}
          href="#dashboard"
          onClick={(e) => { e.preventDefault(); onSelectScreen('dashboard'); }}
          id="nav-dashboard"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity=".5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity=".5" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity=".5" />
          </svg>
          Dashboard
        </a>

        <a
          className={`nav-item${activeScreen === 'billing' ? ' active' : ''}`}
          href="#billing"
          onClick={(e) => { e.preventDefault(); onSelectScreen('billing'); }}
          id="nav-billing"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.8" fill="none" />
            <path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          Create Order
        </a>

        <a
          className={`nav-item${activeScreen === 'transactions' ? ' active' : ''}`}
          href="#transactions"
          onClick={(e) => { e.preventDefault(); onSelectScreen('transactions'); }}
          id="nav-transactions"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Transaction History
        </a>

        <a
          className={`nav-item${activeScreen === 'inventory' ? ' active' : ''}`}
          href="#inventory"
          onClick={(e) => { e.preventDefault(); onSelectScreen('inventory'); }}
          id="nav-inventory"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M20 7l-8-4-8 4m16 0v10l-8 4-8-4V7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round" />
            <path d="M12 3v18" stroke="currentColor" stroke-width="1.8" />
          </svg>
          Inventory
        </a>

        <a
          className={`nav-item${activeScreen === 'forecasting' ? ' active' : ''}`}
          href="#forecasting"
          onClick={(e) => { e.preventDefault(); onSelectScreen('forecasting'); }}
          id="nav-forecasting"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 17l5-5 4 4 5-6 4-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <circle cx="18" cy="7" r="2" fill="currentColor" />
          </svg>
          AI Forecasting
        </a>

        <a
          className={`nav-item${activeScreen === 'reorder' ? ' active' : ''}`}
          href="#reorder"
          onClick={(e) => { e.preventDefault(); onSelectScreen('reorder'); }}
          id="nav-reorder"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" stroke="currentColor" stroke-width="1.8" fill="none" />
            <path d="M17 14v6m-3-3h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          Reorder
        </a>

        <a
          className={`nav-item${activeScreen === 'reports' ? ' active' : ''}`}
          href="#reports"
          onClick={(e) => { e.preventDefault(); onSelectScreen('reports'); }}
          id="nav-reports"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          Reports
        </a>

        <a
          className={`nav-item${activeScreen === 'activity' ? ' active' : ''}`}
          href="#activity"
          onClick={(e) => { e.preventDefault(); onSelectScreen('activity'); }}
          id="nav-activity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
            <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          Activity Log
        </a>

        <a
          className={`nav-item${activeScreen === 'settings' ? ' active' : ''}`}
          href="#settings"
          onClick={(e) => { e.preventDefault(); onSelectScreen('settings'); }}
          id="nav-settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" fill="none" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.8" fill="none" />
          </svg>
          Settings
        </a>
      </nav>

      {/* Sidebar User */}
      <div className="sidebar-user" onClick={() => onSelectScreen('settings')} title="View Store Profile">
        <div className="user-avatar">R</div>
        <div className="user-info">
          <span className="user-name">Ram</span>
          <span className="user-role">Store Manager</span>
        </div>
      </div>
    </aside>
  );
};
