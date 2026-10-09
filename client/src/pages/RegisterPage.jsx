import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Brush, Flower2, Heart, Lock, Mail, Minus, Plus, ShieldCheck, Trophy, User } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';
import { usePayment } from '../hooks/usePayment';
import { api, errorMessage, fieldErrors } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { calculatePricing } from '../utils/pricing';
import { formatINR, normalizeIndianMobile, uuid } from '../utils/format';
import PricingBreakdown from '../components/PricingBreakdown';
import { Field, Spinner } from '../components/ui';

const INITIAL = {
  fullName: '',
  mobileNumber: '',
  address: '',
  // Dandiya Night
  category: '',
  ticketQuantity: 1,
  // Rangoli / Drawing (exactly one competition per registration)
  gender: '',
  competition: '',
};

const FIELD_ORDER = {
  dandiya: ['fullName', 'mobileNumber', 'address', 'category', 'ticketQuantity'],
  competition: ['fullName', 'mobileNumber', 'address', 'gender', 'competition'],
};

function validate(values, type, max) {
  const errors = {};
  const name = values.fullName.trim();
  if (name.length < 2) errors.fullName = 'Please enter your full name';
  else if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(name)) errors.fullName = 'Use letters, spaces, dots, hyphens or apostrophes only';
  if (!normalizeIndianMobile(values.mobileNumber)) errors.mobileNumber = 'Enter a valid 10-digit Indian mobile number';
  if (values.address.trim().length < 5) errors.address = 'Please enter your address';

  if (type === 'competition') {
    if (!['male', 'female'].includes(values.gender)) errors.gender = 'Please select gender';
    if (!['rangoli', 'drawing'].includes(values.competition)) errors.competition = 'Please select Rangoli or Drawing';
  } else {
    if (!['couple', 'single'].includes(values.category)) errors.category = 'Please choose Couple or Single';
    const qty = Number(values.ticketQuantity);
    if (!Number.isInteger(qty) || qty < 1) errors.ticketQuantity = 'Book at least 1 ticket';
    else if (qty > max) errors.ticketQuantity = `You can book at most ${max} tickets per booking`;
  }
  return errors;
}

function buildPayload(values, type) {
  const person = {
    type,
    fullName: values.fullName.trim(),
    mobileNumber: values.mobileNumber.trim(),
    address: values.address.trim(),
  };
  return type === 'competition'
    ? { ...person, gender: values.gender, competition: values.competition }
    : { ...person, category: values.category, ticketQuantity: Number(values.ticketQuantity) };
}

function ChoiceCard({ type = 'radio', name, checked, onChange, icon: Icon, title, price, note }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
        checked ? 'border-maroon-600 bg-maroon-50' : 'border-stone-200 bg-white hover:border-maroon-200'
      }`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 rounded accent-maroon-700"
      />
      <div className="flex-1">
        <p className="flex items-center gap-2 font-semibold text-stone-900">
          <Icon className="h-4 w-4 text-maroon-600" /> {title}
        </p>
        <p className="text-sm text-maroon-700">{price}</p>
        {note && <p className="text-xs text-stone-500">{note}</p>}
      </div>
    </label>
  );
}

/**
 * Registration form for either the Dandiya Night (type "dandiya": Couple/Single tickets)
 * or the Rangoli / Drawing competitions (type "competition"). Each is booked and paid separately.
 */
export default function RegisterPage({ type = 'dandiya' }) {
  const isCompetition = type === 'competition';
  const { event, pricing } = useConfig();
  const { pay, busy: paying } = usePayment();
  const { user } = useAuth();
  // Pre-fill the name from the Google account; the attendee can still edit it.
  const [values, setValues] = useState(() => ({ ...INITIAL, fullName: user?.displayName ?? '' }));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  // Same payload => same clientRequestId, so double submits never create two bookings.
  const lastSubmission = useRef({ payload: null, id: null });

  const max = pricing.maxTicketsPerBooking;
  const breakdown = useMemo(
    () =>
      calculatePricing(pricing, {
        ...values,
        type,
        // One ticket per competition registration.
        ticketQuantity: type === 'competition' ? 1 : values.ticketQuantity,
        rangoliSelected: values.competition === 'rangoli',
        drawingSelected: values.competition === 'drawing',
      }),
    [pricing, values, type],
  );
  const busy = submitting || paying;

  function set(field, value, errorKey = field) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (touched[errorKey] || errors[errorKey]) {
      setErrors((e) => ({ ...e, [errorKey]: validate(next, type, max)[errorKey] }));
    }
  }

  function blur(field) {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validate(values, type, max)[field] }));
  }

  function focusFirstError(errs) {
    const first = FIELD_ORDER[type].find((f) => errs[f]);
    if (first) document.getElementById(first)?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const errs = validate(values, type, max);
    setErrors(errs);
    setTouched(Object.fromEntries(FIELD_ORDER[type].map((f) => [f, true])));
    if (Object.values(errs).some(Boolean)) {
      focusFirstError(errs);
      toast.error('Please correct the highlighted fields');
      return;
    }

    const payload = buildPayload(values, type);
    const key = JSON.stringify(payload);
    if (lastSubmission.current.payload !== key) lastSubmission.current = { payload: key, id: uuid() };

    setSubmitting(true);
    try {
      const { data } = await api.post('/registrations', { ...payload, clientRequestId: lastSubmission.current.id });
      const number = data.registration.registrationNumber;
      setPendingBooking({ number, total: data.breakdown.totalAmountPaise });
      setSubmitting(false);
      await pay(number);
    } catch (err) {
      const fields = fieldErrors(err);
      if (Object.keys(fields).length) {
        setErrors(fields);
        focusFirstError(fields);
      }
      toast.error(await errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!event.registrationOpen) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="section-title">Registrations are closed</h1>
        <p className="mt-3 text-stone-600">Thank you for your interest. Please contact the organisers for help.</p>
        <Link to="/" className="btn-maroon mt-6">
          Back to home
        </Link>
      </div>
    );
  }

  const err = (f) => (touched[f] || errors[f] ? errors[f] : undefined);
  const inputClass = (f) => `input ${err(f) ? 'input-error' : ''}`;
  const aria = (f) => ({ 'aria-invalid': Boolean(err(f)), 'aria-describedby': err(f) ? `${f}-error` : undefined });
  // Display only: base price, with the platform fee shown separately (the total is unchanged).
  const priceOf = (item) => formatINR(item.basePaise);
  const feeNote = (item) => `+ ${formatINR(item.platformFeePaise)} platform fee`;

  const quantityField = (
    <Field
      label="Number of Tickets"
      htmlFor="ticketQuantity"
      error={err('ticketQuantity')}
      hint={`Minimum 1, maximum ${max} per booking`}
      required
    >
      <div className="flex w-44 items-center">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-l-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-40"
          onClick={() => set('ticketQuantity', Math.max(1, Number(values.ticketQuantity) - 1))}
          disabled={Number(values.ticketQuantity) <= 1}
          aria-label="Decrease tickets"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          id="ticketQuantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          className={`${inputClass('ticketQuantity')} h-11 rounded-none border-x-0 text-center`}
          value={values.ticketQuantity}
          onChange={(e) => set('ticketQuantity', e.target.value === '' ? '' : Number(e.target.value))}
          onBlur={() => blur('ticketQuantity')}
          {...aria('ticketQuantity')}
        />
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-r-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-40"
          onClick={() => set('ticketQuantity', Math.min(max, Number(values.ticketQuantity || 0) + 1))}
          disabled={Number(values.ticketQuantity) >= max}
          aria-label="Increase tickets"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </Field>
  );

  return (
    <div className="bg-linear-to-b from-maroon-950 from-0% via-cream via-[220px] to-cream">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6">
        <div className="text-center text-white">
          <h1 className="font-display text-4xl text-gold-300 sm:text-5xl">
            {isCompetition ? 'Rangoli & Drawing Registration' : 'Dandiya Night Registration'}
          </h1>
          <p className="mt-2 text-white/75">
            {event.date} · {isCompetition ? event.competitionTime : event.time} · {event.venue}
          </p>
          <p className="mt-3 text-sm">
            {isCompetition ? (
              <Link to="/register" className="text-gold-200 underline-offset-4 hover:underline">
                Looking for Dandiya Night tickets? Register here →
              </Link>
            ) : (
              <Link to="/register/competitions" className="text-gold-200 underline-offset-4 hover:underline">
                Want to join the Rangoli / Drawing competition? Register separately →
              </Link>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-10 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="card space-y-6 p-5 sm:p-8">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-maroon-800">{isCompetition ? 'Participant details' : 'Your details'}</h2>
                <p className="flex items-center gap-1.5 rounded-full bg-maroon-50 px-3 py-1 text-xs text-maroon-800">
                  <Mail className="h-3.5 w-3.5" /> Tickets will be saved to {user?.email}
                </p>
              </div>
              <Field label="Full Name" htmlFor="fullName" error={err('fullName')} required>
                <input
                  id="fullName"
                  className={inputClass('fullName')}
                  value={values.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  onBlur={() => blur('fullName')}
                  autoComplete="name"
                  maxLength={100}
                  placeholder="e.g. Priya Sharma"
                  {...aria('fullName')}
                />
              </Field>
              <Field
                label="Mobile Number"
                htmlFor="mobileNumber"
                error={err('mobileNumber')}
                hint="10-digit Indian mobile number"
                required
              >
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-xl border border-r-0 border-stone-300 bg-stone-50 px-3 text-sm text-stone-500">
                    +91
                  </span>
                  <input
                    id="mobileNumber"
                    type="tel"
                    inputMode="numeric"
                    className={`${inputClass('mobileNumber')} rounded-l-none`}
                    value={values.mobileNumber}
                    onChange={(e) => set('mobileNumber', e.target.value)}
                    onBlur={() => blur('mobileNumber')}
                    autoComplete="tel-national"
                    maxLength={16}
                    placeholder="98765 43210"
                    {...aria('mobileNumber')}
                  />
                </div>
              </Field>
              <Field label="Address" htmlFor="address" error={err('address')} required>
                <textarea
                  id="address"
                  rows={3}
                  className={inputClass('address')}
                  value={values.address}
                  onChange={(e) => set('address', e.target.value)}
                  onBlur={() => blur('address')}
                  autoComplete="street-address"
                  maxLength={300}
                  placeholder="House / street, area, city"
                  {...aria('address')}
                />
              </Field>
              {isCompetition && (
                <Field label="Gender" htmlFor="gender" error={err('gender')} required>
                  <select
                    id="gender"
                    className={`${inputClass('gender')} ${values.gender ? '' : 'text-stone-400'}`}
                    value={values.gender}
                    onChange={(e) => {
                      set('gender', e.target.value);
                      setTouched((t) => ({ ...t, gender: true }));
                    }}
                    onBlur={() => blur('gender')}
                    {...aria('gender')}
                  >
                    <option value="" disabled>
                      Select gender
                    </option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>
              )}
            </section>

            {isCompetition ? (
              <section className="space-y-3 border-t border-stone-100 pt-6">
                <h2 className="text-lg font-semibold text-maroon-800">
                  Select competition <span className="text-maroon-600">*</span>
                </h2>
                <p className="text-sm text-stone-500">
                  Theme: {event.competitionTheme}. Choose one competition per registration - to enter both, register
                  again for the other one.
                </p>
                <div className="grid gap-3 sm:grid-cols-2" id="competition" tabIndex={-1} role="radiogroup">
                  {[
                    ['rangoli', Flower2, 'Rangoli Competition', 'Colours / rangoli materials of your choice'],
                    ['drawing', Brush, 'Drawing Competition', 'Any medium (pencil, colour, crayons…)'],
                  ].map(([value, Icon, title, note]) => (
                    <ChoiceCard
                      key={value}
                      name="competition"
                      checked={values.competition === value}
                      onChange={() => {
                        set('competition', value);
                        setTouched((t) => ({ ...t, competition: true }));
                      }}
                      icon={Icon}
                      title={title}
                      price={`${priceOf(pricing.competitions[value])} per participant`}
                      note={`${feeNote(pricing.competitions[value])} · ${note}`}
                    />
                  ))}
                </div>
                {err('competition') && (
                  <p id="competition-error" className="text-xs font-medium text-red-600" role="alert">
                    {err('competition')}
                  </p>
                )}
                <p className="flex items-center gap-2 rounded-xl bg-gold-100 px-4 py-3 text-sm text-maroon-900">
                  <Trophy className="h-4 w-4 shrink-0 text-gold-600" />
                  Prizes for each competition: 1st {event.prizes.first} · 2nd {event.prizes.second}
                </p>
              </section>
            ) : (
              <section className="space-y-4 border-t border-stone-100 pt-6">
                <h2 className="text-lg font-semibold text-maroon-800">Tickets</h2>
                <fieldset>
                  <legend className="label">
                    Registration Category <span className="text-maroon-600">*</span>
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2" id="category" tabIndex={-1}>
                    {[
                      ['couple', Heart, 'Couple', 'Admits two people'],
                      ['single', User, 'Single', 'Admits one person'],
                    ].map(([value, Icon, title, note]) => (
                      <ChoiceCard
                        key={value}
                        name="category"
                        checked={values.category === value}
                        onChange={() => {
                          set('category', value);
                          setTouched((t) => ({ ...t, category: true }));
                        }}
                        icon={Icon}
                        title={title}
                        price={`${priceOf(pricing.categories[value])} per ticket`}
                        note={`${feeNote(pricing.categories[value])} · ${note}`}
                      />
                    ))}
                  </div>
                  {err('category') && (
                    <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                      {err('category')}
                    </p>
                  )}
                </fieldset>

                {quantityField}
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <PricingBreakdown
              breakdown={breakdown}
              emptyHint={
                isCompetition
                  ? 'Select Rangoli or Drawing to see the total.'
                  : 'Choose a category and number of tickets to see the total.'
              }
              note="Final amount is confirmed securely by our server before payment."
            />
            <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={busy}>
              {busy ? <Spinner /> : <Lock className="h-5 w-5" />}
              {submitting
                ? 'Saving your registration…'
                : paying
                  ? 'Opening secure payment…'
                  : breakdown
                    ? `Proceed to Pay ${formatINR(breakdown.totalAmountPaise)}`
                    : 'Proceed to Payment'}
            </button>
            {pendingBooking && !busy && (
              <button type="button" className="btn-outline w-full" onClick={() => pay(pendingBooking.number)}>
                Retry payment for {pendingBooking.number}
              </button>
            )}
            <p className="flex items-start gap-2 text-xs text-stone-500">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              Payments are processed securely by Razorpay (UPI, cards, net banking, wallets). Your registration is
              confirmed only after payment is verified.
            </p>
          </aside>
        </form>
      </div>
    </div>
  );
}
