import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Ban, Camera, CameraOff, CheckCircle2, Info, Keyboard, ScanLine, XCircle } from 'lucide-react';
import { adminApi, errorCode, errorMessage } from '../../services/api';
import { ConfirmDialog, Spinner } from '../../components/ui';
import { categoryLabel, competitionsLabel, formatDateTime } from '../../utils/format';

const SCANNER_ID = 'qr-scanner';

/** QR codes hold https://site/staff/check-in?t=<token>; staff may also type a ticket number. */
function extractCode(text) {
  const value = text.trim();
  try {
    const token = new URL(value).searchParams.get('t');
    if (token) return token;
  } catch {
    // not a URL
  }
  return value;
}

const RESULT_STYLES = {
  valid: { box: 'bg-emerald-50 ring-emerald-500', icon: CheckCircle2, iconClass: 'text-emerald-600', title: 'Valid ticket' },
  checked_in: { box: 'bg-emerald-600 text-white ring-emerald-700', icon: CheckCircle2, iconClass: 'text-white', title: 'Checked in - allow entry' },
  already_checked_in: { box: 'bg-amber-50 ring-amber-500', icon: Info, iconClass: 'text-amber-600', title: 'Already checked in' },
  cancelled: { box: 'bg-red-50 ring-red-500', icon: Ban, iconClass: 'text-red-600', title: 'Ticket cancelled' },
  invalid: { box: 'bg-red-50 ring-red-500', icon: XCircle, iconClass: 'text-red-600', title: 'Invalid ticket' },
};

function ResultCard({ result, onCheckIn, onNext, busy }) {
  const style = RESULT_STYLES[result.result] ?? RESULT_STYLES.invalid;
  const Icon = style.icon;
  const t = result.ticket;
  const dark = result.result === 'checked_in';

  return (
    <div className={`rounded-2xl p-5 ring-2 ${style.box}`} role="status" aria-live="assertive">
      <div className="flex items-center gap-3">
        <Icon className={`h-10 w-10 shrink-0 ${style.iconClass}`} />
        <div>
          <p className="text-xl font-bold">{style.title}</p>
          {t && <p className={`font-mono text-sm ${dark ? 'text-white/80' : 'text-stone-600'}`}>{t.ticketNumber}</p>}
        </div>
      </div>

      {t && (
        <dl className={`mt-4 grid grid-cols-2 gap-3 text-sm ${dark ? 'text-white' : 'text-stone-800'}`}>
          <div>
            <dt className={`text-xs ${dark ? 'text-white/70' : 'text-stone-500'}`}>Name</dt>
            <dd className="font-semibold">{t.holderName}</dd>
          </div>
          <div>
            <dt className={`text-xs ${dark ? 'text-white/70' : 'text-stone-500'}`}>Entry</dt>
            <dd className="font-semibold">
              {categoryLabel(t.category)} ({t.category === 'couple' ? 'admits 2' : 'admits 1'})
            </dd>
          </div>
          <div>
            <dt className={`text-xs ${dark ? 'text-white/70' : 'text-stone-500'}`}>Booking</dt>
            <dd className="font-mono">
              {t.registrationNumber} · {t.ticketsInBooking} ticket{t.ticketsInBooking > 1 ? 's' : ''}
            </dd>
          </div>
          <div>
            <dt className={`text-xs ${dark ? 'text-white/70' : 'text-stone-500'}`}>Competitions</dt>
            <dd>{competitionsLabel(t)}</dd>
          </div>
          {t.checkedInAt && (
            <div className="col-span-2">
              <dt className={`text-xs ${dark ? 'text-white/70' : 'text-stone-500'}`}>Checked in</dt>
              <dd>
                {formatDateTime(t.checkedInAt)}
                {t.checkedInBy ? ` by ${t.checkedInBy}` : ''}
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {result.result === 'valid' && (
          <button type="button" className="btn-maroon flex-1 py-3 text-base" onClick={onCheckIn} disabled={busy}>
            {busy ? <Spinner /> : <CheckCircle2 className="h-5 w-5" />} Check in
          </button>
        )}
        <button
          type="button"
          className={`${dark ? 'btn bg-white text-emerald-700' : 'btn-outline'} flex-1 py-3`}
          onClick={onNext}
          disabled={busy}
        >
          <ScanLine className="h-5 w-5" /> Scan next ticket
        </button>
      </div>
    </div>
  );
}

export default function CheckInPage() {
  const [params, setParams] = useSearchParams();
  const [manual, setManual] = useState('');
  const [result, setResult] = useState(null);
  const [code, setCode] = useState(null);
  const [looking, setLooking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null);
  const handledToken = useRef(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        // already stopped
      }
    }
  }, []);

  const lookup = useCallback(
    async (rawCode) => {
      const value = extractCode(rawCode);
      if (!value) return;
      await stopScanner();
      setLooking(true);
      setResult(null);
      setCode(value);
      try {
        const { data } = await adminApi.get(`/tickets/verify/${encodeURIComponent(value)}`);
        setResult(data);
        if (navigator.vibrate) navigator.vibrate(data.result === 'valid' ? 80 : [60, 60, 60]);
      } catch (err) {
        if (err?.response?.status === 400) setResult({ result: 'invalid', ticket: null });
        else toast.error(await errorMessage(err));
      } finally {
        setLooking(false);
      }
    },
    [stopScanner],
  );

  const startScanner = useCallback(async () => {
    setCameraError('');
    setResult(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      setScanning(true);
      // Let React render the (visible) scanner container before the library measures it.
      await new Promise((resolve) => setTimeout(resolve, 60));
      const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h, 280) * 0.85, height: Math.min(w, h, 280) * 0.85 }) },
        (decoded) => lookup(decoded),
        () => {},
      );
    } catch (err) {
      scannerRef.current = null;
      setScanning(false);
      setCameraError(
        /permission|notallowed/i.test(String(err))
          ? 'Camera permission was denied. Allow camera access in your browser settings, or enter the ticket number below.'
          : 'Could not start the camera. You can enter the ticket number below instead.',
      );
    }
  }, [lookup]);

  // QR scanned with the phone's own camera app opens /staff/check-in?t=<token>.
  useEffect(() => {
    const token = params.get('t');
    if (token && handledToken.current !== token) {
      handledToken.current = token;
      lookup(token);
      setParams({}, { replace: true });
    }
  }, [params, setParams, lookup]);

  useEffect(() => () => void stopScanner(), [stopScanner]);

  async function checkIn() {
    setChecking(true);
    try {
      const { data } = await adminApi.post(`/tickets/${encodeURIComponent(code)}/check-in`);
      setResult({ ...data, result: 'checked_in' });
      toast.success(`${data.ticket.ticketNumber} checked in`);
      if (navigator.vibrate) navigator.vibrate(150);
    } catch (err) {
      const details = err?.response?.data?.error?.details;
      if (details?.result) setResult(details);
      toast.error(errorCode(err) === 'ALREADY_CHECKED_IN' ? 'This ticket was already checked in' : await errorMessage(err));
    } finally {
      setChecking(false);
      setConfirmOpen(false);
    }
  }

  function next() {
    setResult(null);
    setCode(null);
    setManual('');
    startScanner();
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Ticket Check-in</h1>
        <p className="text-sm text-stone-500">Scan the QR code on the attendee's ticket, or enter the ticket number.</p>
      </div>

      {result ? (
        <ResultCard result={result} onCheckIn={() => setConfirmOpen(true)} onNext={next} busy={checking} />
      ) : (
        <div className="card overflow-hidden">
          <div className="relative bg-stone-900">
            <div id={SCANNER_ID} className={`w-full ${scanning ? 'min-h-72' : 'hidden'}`} />
            {!scanning && (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
                {looking ? (
                  <>
                    <Spinner className="h-8 w-8" /> Checking ticket…
                  </>
                ) : (
                  <>
                    <Camera className="h-10 w-10 text-gold-300" />
                    <button type="button" className="btn-primary" onClick={startScanner}>
                      <ScanLine className="h-4 w-4" /> Start camera scanner
                    </button>
                    {cameraError && <p className="max-w-sm text-sm text-red-300">{cameraError}</p>}
                  </>
                )}
              </div>
            )}
          </div>
          {scanning && (
            <div className="flex justify-center p-3">
              <button type="button" className="btn-outline" onClick={stopScanner}>
                <CameraOff className="h-4 w-4" /> Stop camera
              </button>
            </div>
          )}
        </div>
      )}

      <form
        className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(manual);
        }}
      >
        <label className="flex-1">
          <span className="label flex items-center gap-1.5">
            <Keyboard className="h-4 w-4" /> Ticket number
          </span>
          <input
            className="input font-mono uppercase"
            placeholder="DN26XXXXXX-01"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="btn-maroon py-2.5" disabled={!manual.trim() || looking}>
          {looking && <Spinner className="h-4 w-4" />} Verify
        </button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm check-in"
        message={
          result?.ticket && (
            <>
              Admit <strong>{result.ticket.holderName}</strong> with ticket{' '}
              <span className="font-mono">{result.ticket.ticketNumber}</span>? This can't be undone.
            </>
          )
        }
        confirmLabel="Check in"
        busy={checking}
        onConfirm={checkIn}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
