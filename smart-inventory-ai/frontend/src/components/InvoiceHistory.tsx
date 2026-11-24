import React, { useEffect, useState } from 'react';
import { Receipt, Eye, RefreshCw, X, Printer, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { InvoiceReceipt, InvoiceSummary } from '../types';

export const InvoiceHistory: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedReceipt, setSelectedReceipt] = useState<InvoiceReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState<boolean>(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getInvoices(30);
      setInvoices(res.invoices);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch invoice history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleViewReceipt = async (invNo: string) => {
    try {
      setReceiptLoading(true);
      const res = await api.getInvoice(invNo);
      setSelectedReceipt(res);
    } catch (err: any) {
      alert(`Could not fetch invoice details: ${err.message}`);
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Receipt size={26} style={{ color: '#3b82f6' }} />
            POS Invoice History
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            View completed transactions and historical customer billing receipts
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchInvoices}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="alert-box alert-danger">
          <p>{error}</p>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Payment Method</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 0.5rem auto' }} />
                  <p style={{ color: '#94a3b8' }}>Loading invoices...</p>
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No invoices created yet. Process your first checkout in the POS Billing Terminal!
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.invoice_id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#60a5fa' }}>{inv.invoice_no}</td>
                  <td>{new Date(inv.invoice_date).toLocaleString()}</td>
                  <td>{inv.customer_name}</td>
                  <td>
                    <span className="badge badge-reorder">{inv.payment_method}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#34d399' }}>₹{inv.total_amount.toFixed(2)}</td>
                  <td>
                    <span className="badge badge-healthy">{inv.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleViewReceipt(inv.invoice_no)}
                      title="View Receipt"
                    >
                      <Eye size={14} />
                      <span>Receipt</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail Modal */}
      {selectedReceipt && (
        <div className="modal-backdrop" onClick={() => setSelectedReceipt(null)}>
          <div className="modal-box" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Invoice Receipt</h3>
              </div>
              <button className="modal-close" onClick={() => setSelectedReceipt(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '12px', border: '1px solid #334155', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px dashed #475569' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>SMART KIRANA STORE</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Invoice No: {selectedReceipt.invoice_no}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: '#94a3b8' }}>Customer:</span>
                <span>{selectedReceipt.customer_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ color: '#94a3b8' }}>Payment Method:</span>
                <span style={{ fontWeight: 600 }}>{selectedReceipt.payment_method}</span>
              </div>

              <table style={{ width: '100%', fontSize: '0.8rem', borderTop: '1px solid #334155', paddingTop: '0.5rem' }}>
                <thead>
                  <tr style={{ color: '#94a3b8' }}>
                    <th style={{ padding: '0.4rem 0' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '0.4rem 0' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceipt.items.map((it) => (
                    <tr key={it.stock_code}>
                      <td style={{ padding: '0.4rem 0' }}>{it.product_name}</td>
                      <td style={{ textAlign: 'center', padding: '0.4rem 0' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0' }}>₹{it.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '1rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px dashed #475569',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: '#34d399',
                }}
              >
                <span>Total Amount:</span>
                <span>₹{selectedReceipt.total_amount.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={16} />
                <span>Print</span>
              </button>
              <button className="btn btn-primary" onClick={() => setSelectedReceipt(null)}>
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
