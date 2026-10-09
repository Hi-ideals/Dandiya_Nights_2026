import { useState } from 'react';
import toast from 'react-hot-toast';
import { FileSpreadsheet } from 'lucide-react';
import { downloadFile, errorMessage } from '../services/api';
import { Spinner } from './ui';

const PRESETS = [
  { key: 'all', label: 'All registrations', params: {} },
  { key: 'paid', label: 'Successful payments', params: { paymentStatus: 'paid' } },
  { key: 'pending', label: 'Pending payments', params: { paymentStatus: 'pending' } },
  { key: 'failed', label: 'Failed payments', params: { paymentStatus: 'failed' } },
];

export async function exportExcel(params) {
  const clean = Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== '' && v != null && !['page', 'pageSize'].includes(k)));
  await downloadFile('/admin/export/excel', { params: clean, fallbackName: 'dandiya-registrations.xlsx' });
}

/** Excel export controls: optional "current filters" plus the standard presets. */
export default function ExportMenu({ filters }) {
  const [busy, setBusy] = useState(null);

  async function run(key, params) {
    setBusy(key);
    try {
      await exportExcel(params);
      toast.success('Excel file downloaded');
    } catch (err) {
      toast.error(await errorMessage(err, 'Export failed'));
    } finally {
      setBusy(null);
    }
  }

  const options = filters ? [{ key: 'filtered', label: 'Current filters', params: filters }, ...PRESETS] : PRESETS;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-sm font-medium text-stone-600">
        <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export to Excel:
      </span>
      {options.map(({ key, label, params }) => (
        <button
          key={key}
          type="button"
          className={`${key === 'filtered' ? 'btn-maroon' : 'btn-outline'} px-3 py-1.5 text-xs`}
          onClick={() => run(key, params)}
          disabled={Boolean(busy)}
        >
          {busy === key && <Spinner className="h-3.5 w-3.5" />} {label}
        </button>
      ))}
    </div>
  );
}
