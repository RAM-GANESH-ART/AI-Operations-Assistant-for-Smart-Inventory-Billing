import React, { useState } from 'react';

interface SettingsScreenProps {
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onShowToast }) => {
  const [storeName, setStoreName] = useState('SmartStock Retail');
  const [ownerName, setOwnerName] = useState('Ram Ganesh');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [address, setAddress] = useState('123, Main Street, Chennai');
  const [gst, setGst] = useState('33ABCDE1234F1Z5');

  const [lowStock, setLowStock] = useState(true);
  const [expiry, setExpiry] = useState(true);
  const [dailySales, setDailySales] = useState(true);
  const [reorderNotif, setReorderNotif] = useState(true);
  const [aiForecasting, setAiForecasting] = useState(true);
  const [autoReorder, setAutoReorder] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onShowToast('Store settings and operational parameters saved!', 'success');
  };

  return (
    <section className="screen active" id="screen-settings">
      <div className="screen-header">
        <div>
          <h1>Settings</h1>
          <p className="screen-subtitle">Configure your store and application preferences</p>
        </div>
      </div>

      <div className="settings-grid">
        <form onSubmit={handleSave} className="card settings-card">
          <h3>Store Information</h3>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Store Name</label>
            <input
              type="text"
              id="setting-store-name"
              className="form-input"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Owner Name</label>
            <input
              type="text"
              id="setting-owner-name"
              className="form-input"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Phone</label>
            <input
              type="tel"
              id="setting-phone"
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Address</label>
            <input
              type="text"
              id="setting-address"
              className="form-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">GST Number</label>
            <input
              type="text"
              id="setting-gst"
              className="form-input"
              value={gst}
              onChange={(e) => setGst(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" id="setting-save-btn">
            Save Changes
          </button>
        </form>

        <div className="card settings-card">
          <h3>Notifications</h3>
          <div className="toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span>Low Stock Alerts</span>
            <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
          </div>
          <div className="toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span>Expiry Alerts</span>
            <input type="checkbox" checked={expiry} onChange={(e) => setExpiry(e.target.checked)} />
          </div>
          <div className="toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span>Daily Sales Summary</span>
            <input type="checkbox" checked={dailySales} onChange={(e) => setDailySales(e.target.checked)} />
          </div>
          <div className="toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span>Reorder Recommendations</span>
            <input type="checkbox" checked={reorderNotif} onChange={(e) => setReorderNotif(e.target.checked)} />
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '8px' }}>AI &amp; Forecasting</h3>
          <div className="toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span>Enable AI Demand Forecasting</span>
            <input type="checkbox" checked={aiForecasting} onChange={(e) => setAiForecasting(e.target.checked)} />
          </div>
          <div className="toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            <span>Auto Reorder Suggestions</span>
            <input type="checkbox" checked={autoReorder} onChange={(e) => setAutoReorder(e.target.checked)} />
          </div>
        </div>
      </div>
    </section>
  );
};
