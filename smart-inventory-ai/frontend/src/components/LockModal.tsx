import React from 'react';

interface LockModalProps {
  isOpen: boolean;
  onResume: () => void;
}

export const LockModal: React.FC<LockModalProps> = ({ isOpen, onResume }) => {
  if (!isOpen) return null;

  return (
    <div className={`lock-modal-overlay${isOpen ? ' show' : ''}`} id="lock-modal" aria-hidden={!isOpen}>
      <div className="lock-modal-card">
        <div className="lock-avatar-glow">
          <div className="lock-avatar">R</div>
        </div>
        <h2>Terminal Locked</h2>
        <p className="lock-subtitle">Store Manager session is temporarily locked for security.</p>
        <div className="lock-user-pill">
          <span className="online-indicator"></span> Ram Ganesh &bull; Store #01
        </div>
        <button
          type="button"
          className="btn-primary lock-resume-btn"
          id="lock-resume-btn"
          onClick={onResume}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 11V7a5 5 0 0110 0v4M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Unlock &amp; Resume Session</span>
        </button>
      </div>
    </div>
  );
};
