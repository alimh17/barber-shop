import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  open, title, description, confirmLabel = '\u062a\u0623\u06cc\u06cc\u062f', cancelLabel = '\u0627\u0646\u0635\u0631\u0627\u0641',
  pending = false, destructive = false, onConfirm, onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-modal"
      dir="rtl"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
      onCancel={(event) => { if (pending) event.preventDefault(); else onClose(); }}
      onClose={() => { if (open && !pending) onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current && !pending) onClose(); }}
    >
      <div className="confirm-modal-heading">
        <span className={destructive ? 'confirm-modal-icon destructive' : 'confirm-modal-icon'}><AlertTriangle size={22} /></span>
        <button type="button" className="confirm-modal-close" aria-label="\u0628\u0633\u062a\u0646" disabled={pending} onClick={onClose}><X size={20} /></button>
      </div>
      <h2 id="confirm-modal-title">{title}</h2>
      <p id="confirm-modal-description">{description}</p>
      <div className="confirm-modal-actions">
        <button type="button" className="confirm-modal-cancel" disabled={pending} onClick={onClose}>{cancelLabel}</button>
        <button type="button" className={destructive ? 'confirm-modal-accept destructive' : 'confirm-modal-accept'} disabled={pending} onClick={onConfirm}>{pending ? '\u062f\u0631 \u062d\u0627\u0644 \u0627\u0646\u062c\u0627\u0645...' : confirmLabel}</button>
      </div>
    </dialog>
  );
}
