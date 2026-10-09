import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Search, SearchX, X } from 'lucide-react';
import { adminApi, errorMessage } from '../../services/api';
import ExportMenu from '../../components/ExportMenu';
import { EmptyState, Pagination, Spinner, StatusBadge } from '../../components/ui';
import { categoryLabel, formatDateTime, formatINR, genderLabel, registrationTypeLabel } from '../../utils/format';

const FILTER_KEYS = ['q', 'type', 'category', 'paymentStatus', 'competition', 'checkIn', 'from', 'to'];

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      <select className="input py-2" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckInCell({ checkIn }) {
  if (!checkIn.total) return <span className="text-stone-400">-</span>;
  const status = checkIn.state === 'all' ? 'checked_in' : checkIn.state === 'partial' ? 'pending' : 'cancelled';
  return <StatusBadge status={status} label={`${checkIn.checkedIn}/${checkIn.total} in`} />;
}

export default function RegistrationsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const filters = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])),
    [params],
  );
  const page = Number(params.get('page')) || 1;

  function update(changes, resetPage = true) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  }

  // Debounced search box.
  useEffect(() => {
    if (search === (params.get('q') ?? '')) return undefined;
    const t = setTimeout(() => update({ q: search.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    adminApi
      .get('/admin/registrations', { params: { ...query, page, pageSize: 20 } })
      .then(({ data }) => {
        if (cancelled) return;
        setResult(data);
        setError('');
      })
      .catch(async (err) => !cancelled && setError(await errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  const activeFilters = FILTER_KEYS.filter((k) => filters[k]).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Registrations</h1>
        <p className="text-sm text-stone-500">Search, filter and export bookings.</p>
      </div>

      <div className="card space-y-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            className="input pl-10"
            placeholder="Search by name, mobile, registration no. or ticket no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search registrations"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Select
            label="Registration"
            value={filters.type}
            onChange={(v) => update({ type: v })}
            options={[['', 'All'], ['dandiya', 'Dandiya Night'], ['competition', 'Rangoli / Drawing']]}
          />
          <Select
            label="Payment status"
            value={filters.paymentStatus}
            onChange={(v) => update({ paymentStatus: v })}
            options={[['', 'All'], ['paid', 'Paid'], ['pending', 'Pending'], ['failed', 'Failed'], ['cancelled', 'Cancelled']]}
          />
          <Select
            label="Category"
            value={filters.category}
            onChange={(v) => update({ category: v })}
            options={[['', 'All'], ['couple', 'Couple'], ['single', 'Single']]}
          />
          <Select
            label="Competition"
            value={filters.competition}
            onChange={(v) => update({ competition: v })}
            options={[
              ['', 'All'],
              ['rangoli', 'Rangoli'],
              ['drawing', 'Drawing'],
              ['both', 'Both'],
              ['any', 'Any competition'],
              ['none', 'No competition'],
            ]}
          />
          <Select
            label="Check-in"
            value={filters.checkIn}
            onChange={(v) => update({ checkIn: v })}
            options={[['', 'All'], ['none', 'Not checked in'], ['partial', 'Partially'], ['all', 'Fully checked in']]}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-500">From date</span>
            <input type="date" className="input py-2" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-500">To date</span>
            <input type="date" className="input py-2" value={filters.to} onChange={(e) => update({ to: e.target.value })} />
          </label>
        </div>
        {activeFilters > 0 && (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => {
              setSearch('');
              setParams({}, { replace: true });
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          </button>
        )}
        <div className="border-t border-stone-100 pt-3">
          <ExportMenu filters={filters} />
        </div>
      </div>

      <div className="card relative overflow-hidden">
        {loading && result && (
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-16">
            <Spinner className="h-6 w-6 text-maroon-700" />
          </div>
        )}
        {error ? (
          <EmptyState icon={AlertCircle} title="Couldn't load registrations">
            {error}
          </EmptyState>
        ) : !result ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8 text-maroon-700" />
          </div>
        ) : result.items.length === 0 ? (
          <EmptyState icon={SearchX} title="No registrations match these filters" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px] text-left text-sm">
                <thead className="bg-stone-50 text-xs text-stone-500 uppercase">
                  <tr>
                    {[
                      'Reg. No.',
                      'Registered',
                      'Type',
                      'Name',
                      'Gender',
                      'Mobile',
                      'Address',
                      'Category',
                      'Qty',
                      'Rangoli',
                      'Drawing',
                      'Payment',
                      'Amount paid',
                      'Order ID',
                      'Payment ID',
                      'Ticket numbers',
                      'Check-in',
                    ].map((h) => (
                      <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {result.items.map((r) => (
                    <tr key={r.registrationNumber} className="align-top hover:bg-stone-50">
                      <td className="px-3 py-2.5 font-mono text-xs">
                        <Link to={`/admin/registrations/${r.registrationNumber}`} className="font-semibold text-maroon-700 hover:underline">
                          {r.registrationNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-stone-500">{formatDateTime(r.createdAt)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.type === 'competition' ? 'bg-sky-50 text-sky-700' : 'bg-gold-100 text-maroon-800'
                          }`}
                        >
                          {registrationTypeLabel(r.type)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{r.fullName}</td>
                      <td className="px-3 py-2.5">{r.gender ? genderLabel(r.gender) : '-'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.mobileNumber}</td>
                      <td className="max-w-56 px-3 py-2.5 text-xs text-stone-600" title={r.address}>
                        <span className="line-clamp-2">{r.address}</span>
                      </td>
                      <td className="px-3 py-2.5">{categoryLabel(r.category)}</td>
                      <td className="px-3 py-2.5 text-center">{r.ticketQuantity}</td>
                      <td className="px-3 py-2.5 text-center">{r.rangoliSelected ? '✓' : '-'}</td>
                      <td className="px-3 py-2.5 text-center">{r.drawingSelected ? '✓' : '-'}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={r.paymentStatus} />
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{r.amountPaidPaise ? formatINR(r.amountPaidPaise) : '-'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-stone-500">{r.razorpayOrderId ?? '-'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-stone-500">{r.razorpayPaymentId ?? '-'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.ticketNumbers.join(', ') || '-'}</td>
                      <td className="px-3 py-2.5">
                        <CheckInCell checkIn={r.checkIn} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...result.pagination} onPage={(p) => update({ page: String(p) }, false)} />
          </>
        )}
      </div>
    </div>
  );
}
