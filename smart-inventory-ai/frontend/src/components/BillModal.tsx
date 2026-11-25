import React from 'react';
import { InvoiceReceipt } from '../types';

interface BillModalProps {
  receipt: InvoiceReceipt | null;
  onClose: () => void;
  onNewOrder: () => void;
}

export const BillModal: React.FC<BillModalProps> = ({ receipt, onClose, onNewOrder }) => {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const subtotal = receipt.items.reduce((s, it) => s + it.line_total, 0);
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = receipt.total_amount || (subtotal + gst);

  return (
    <div className="modal-overlay" id="bill-modal" style={{ display: 'flex' }} onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2>Tax Invoice &amp; Receipt 🧾</h2>
          <button className="modal-close" id="close-bill-modal" onClick={onClose} aria-label="Close receipt modal">
            ✕
          </button>
        </div>

        <div className="modal-body" id="bill-modal-content">
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>SMARTSTOCK RETAIL</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>123, Main Street, Chennai &bull; GSTIN: 33ABCDE1234F1Z5</p>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Bill No: <strong style={{ color: 'var(--blue)' }}>{receipt.invoice_no}</strong> &bull; {new Date(receipt.invoice_date || Date.now()).toLocaleString()}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px dashed var(--border)' }}>
            <span>Customer: <strong style={{ color: 'var(--text-primary)' }}>{receipt.customer_name}</strong></span>
            <span>Pay Mode: <strong style={{ color: 'var(--green)' }}>{receipt.payment_method}</strong></span>
          </div>

          <table className="data-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Item</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((it) => (
                <tr key={it.stock_code}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--blue)' }}>{it.stock_code}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                  <td style={{ textAlign: 'right' }}>₹{it.unit_price.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#34d399' }}>₹{it.line_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Subtotal:</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>GST (Included):</span>
              <span>₹{gst.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#34d399', paddingTop: '6px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
              <span>Grand Total:</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-outline" id="print-bill" onClick={handlePrint}>
            🖨️ Print
          </button>
          <button className="btn-primary" id="new-bill" onClick={onNewOrder}>
            New Order
          </button>
        </div>
      </div>
    </div>
  );
};
