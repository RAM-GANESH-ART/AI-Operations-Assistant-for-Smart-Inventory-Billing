import React, { useState } from 'react';
import { ActivityLogItem } from '../types';

interface ActivityScreenProps {
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const INITIAL_LOGS: ActivityLogItem[] = [
  {
    id: 'act-1',
    type: 'order',
    title: 'POS Invoice B-2026-089 Issued',
    desc: 'Customer checkout processed: 3 items totaling ₹840.00 via UPI payment.',
    timestamp: '10 mins ago',
    badge: 'Bill #089',
  },
  {
    id: 'act-2',
    type: 'alert',
    title: 'Stock Buffer Alert Triggered',
    desc: 'SKU-10002 breached minimum safety buffer (Available: 12 units, Min: 30 units).',
    timestamp: '35 mins ago',
    badge: 'Warning',
  },
  {
    id: 'act-3',
    type: 'reorder',
    title: 'Purchase Order PO-2026-14 Dispatched',
    desc: 'Automated order for 250 units generated across 4 critical categories.',
    timestamp: '2 hours ago',
    badge: 'Procurement',
  },
  {
    id: 'act-4',
    type: 'stock',
    title: 'Stock Movement Audit Recorded',
    desc: 'Inventory adjustment for ASSORTED COLOUR BIRD ORNAMENT (+50 units received).',
    timestamp: '4 hours ago',
    badge: 'Inventory',
  },
  {
    id: 'act-5',
    type: 'order',
    title: 'POS Invoice B-2026-088 Issued',
    desc: 'Walk-in customer checkout: 5 items totaling ₹1,420.00 via Cash.',
    timestamp: '5 hours ago',
    badge: 'Bill #088',
  },
];

export const ActivityScreen: React.FC<ActivityScreenProps> = ({ onShowToast }) => {
  const [logs, setLogs] = useState<ActivityLogItem[]>(INITIAL_LOGS);
  const [filter, setFilter] = useState<'all' | 'order' | 'stock' | 'reorder' | 'alert'>('all');

  const filteredLogs = logs.filter((l) => filter === 'all' || l.type === filter);

  const handleExport = () => {
    const csv = 'Timestamp,Type,Title,Details\n' +
      logs.map((l) => `"${l.timestamp}","${l.type}","${l.title}","${l.desc}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Activity logs exported to CSV', 'success');
  };

  const handleClear = () => {
    setLogs([]);
    onShowToast('Activity timeline cleared', 'info');
  };

  return (
    <section className="screen active" id="screen-activity">
      <div className="screen-header">
        <div>
          <h1>Activity Log</h1>
          <p className="screen-subtitle">Real-time system activity and audit timeline</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="button" className="btn-outline" id="btn-export-activity" title="Export activity history as CSV" onClick={handleExport}>
            <span>📥 Export CSV</span>
          </button>
          <button
            type="button"
            className="btn-outline"
            id="btn-clear-activity"
            title="Clear log history"
            style={{ borderColor: 'rgba(239,68,68,0.4)', color: 'var(--red)' }}
            onClick={handleClear}
          >
            <span>🗑️ Clear Logs</span>
          </button>
        </div>
      </div>

      <div className="activity-log-container">
        <div className="activity-filter-bar">
          <button
            type="button"
            className={`activity-chip${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`activity-chip${filter === 'order' ? ' active' : ''}`}
            onClick={() => setFilter('order')}
          >
            Orders &amp; Sales
          </button>
          <button
            type="button"
            className={`activity-chip${filter === 'stock' ? ' active' : ''}`}
            onClick={() => setFilter('stock')}
          >
            Stock Updates
          </button>
          <button
            type="button"
            className={`activity-chip${filter === 'reorder' ? ' active' : ''}`}
            onClick={() => setFilter('reorder')}
          >
            Reorders
          </button>
          <button
            type="button"
            className={`activity-chip${filter === 'alert' ? ' active' : ''}`}
            onClick={() => setFilter('alert')}
          >
            Alerts &amp; Risk
          </button>
        </div>

        <div className="activity-timeline-wrap" style={{ position: 'relative', marginTop: '20px' }}>
          <div className="timeline-vertical-line" style={{ position: 'absolute', left: '16px', top: '0', bottom: '0', width: '2px', background: 'var(--border)' }}></div>
          <div className="activity-timeline" id="activity-timeline-list" style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingLeft: '38px' }}>
            {filteredLogs.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '-31px',
                    top: '16px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: item.type === 'alert' ? 'var(--red)' : item.type === 'order' ? 'var(--green)' : 'var(--blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    color: '#fff',
                  }}
                >
                  {item.type === 'alert' ? '!' : item.type === 'order' ? '₹' : '•'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {item.title}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.timestamp}</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {item.desc}
                </p>
                {item.badge && (
                  <span
                    className="badge badge-healthy"
                    style={{ marginTop: '8px', display: 'inline-block', fontSize: '10px' }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No activity records for this filter category.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
