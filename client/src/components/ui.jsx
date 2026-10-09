import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-maroon-700" role="status">
      <Spinner className="h-8 w-8" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

const BADGE_STYLES = {
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  valid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  failed: 'bg-red-50 text-red-700 ring-red-600/20',
  invalid: 'bg-red-50 text-red-700 ring-red-600/20',
  cancelled: 'bg-stone-100 text-stone-700 ring-stone-500/20',
  already_checked_in: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  checked_in: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  duplicate: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  created: 'bg-amber-50 text-amber-800 ring-amber-600/20',
};

const BADGE_LABELS = {
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  cancelled: 'Cancelled',
  valid: 'Valid',
  invalid: 'Invalid',
  already_checked_in: 'Already checked in',
  checked_in: 'Checked in',
  duplicate: 'Duplicate - refund',
  created: 'Awaiting payment',
};

export function StatusBadge({ status, label }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        BADGE_STYLES[status] ?? 'bg-stone-100 text-stone-700 ring-stone-500/20'
      }`}
    >
      {label ?? BADGE_LABELS[status] ?? status}
    </span>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel?.();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <div className="mt-2 text-sm text-stone-600">{message}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-maroon" onClick={onConfirm} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function Field({ label, htmlFor, error, hint, children, required }) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="text-maroon-600"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {Icon && <Icon className="h-10 w-10 text-maroon-200" aria-hidden="true" />}
      <p className="font-semibold text-stone-800">{title}</p>
      {children && <div className="text-sm text-stone-500">{children}</div>}
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPage }) {
  if (!total) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 text-sm">
      <p className="text-stone-500">
        Page <span className="font-semibold text-stone-800">{page}</span> of {totalPages} · {total} records
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-outline px-4 py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button
          type="button"
          className="btn-outline px-4 py-1.5"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
