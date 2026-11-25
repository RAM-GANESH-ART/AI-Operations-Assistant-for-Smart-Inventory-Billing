import React from 'react';

export interface ToastMessage {
  id: string;
  msg: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ToastProps {
  toasts: ToastMessage[];
}

export const Toast: React.FC<ToastProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type || 'info'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : t.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
};
