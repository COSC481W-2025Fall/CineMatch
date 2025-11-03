// src/components/ErrorModal.jsx
import React, { useEffect } from "react";

export default function ErrorModal({ message, onClose }) {
  // Close on ESC
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!message) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-title"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="modal-header">
          <h2 id="error-title" style={{ margin: 0 }}>There’s a problem</h2>
        </div>

        <div className="modal-body">
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      </div>
    </div>
  );
}