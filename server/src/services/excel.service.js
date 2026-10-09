import ExcelJS from 'exceljs';
import { getEventConfig } from '../config/event.js';
import { paiseToRupees, toIstWallClock } from '../utils/format.js';
import { getPaymentsForRows, queryRegistrationRows, summarize } from './admin.service.js';

const INR_FORMAT = '"₹"#,##0.00';
const DATE_FORMAT = 'dd-mmm-yyyy hh:mm AM/PM';
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7A1035' } };

/** Neutralise spreadsheet formula injection (=, +, -, @, tab, CR at the start of a cell). */
export function safeCell(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function styleSheet(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 24;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (sheet.columnCount > 1) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  }
}

const competitionLabel = (row) =>
  [row.rangoliSelected && 'Rangoli', row.drawingSelected && 'Drawing'].filter(Boolean).join(', ') || 'None';

const checkInDetails = (row) =>
  row.tickets.map((t) => `${t.ticketNumber}: ${t.checkedIn ? 'Checked in' : 'Not checked in'}`).join('\n');

export async function buildRegistrationsWorkbook(filters) {
  const rows = await queryRegistrationRows(filters, { allTickets: true });
  const payments = await getPaymentsForRows(rows);
  const registrationNumbers = new Set(rows.map((r) => r.registrationNumber));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = getEventConfig().organizer;
  workbook.created = new Date();

  // Sheet 1: Registrations
  const regSheet = workbook.addWorksheet('Registrations');
  regSheet.columns = [
    { header: 'Registration No.', key: 'registrationNumber', width: 16 },
    { header: 'Registration Type', key: 'type', width: 18 },
    { header: 'Participant Name', key: 'fullName', width: 26 },
    { header: 'Gender', key: 'gender', width: 9 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 15 },
    { header: 'Address', key: 'address', width: 40 },
    { header: 'Category', key: 'category', width: 10 },
    { header: 'Tickets', key: 'ticketQuantity', width: 9 },
    { header: 'Competitions', key: 'competitions', width: 18 },
    { header: 'Registered At (IST)', key: 'createdAt', width: 22, style: { numFmt: DATE_FORMAT } },
    { header: 'Payment Status', key: 'paymentStatus', width: 15 },
    { header: 'Total Amount', key: 'totalAmount', width: 14, style: { numFmt: INR_FORMAT } },
    { header: 'Amount Paid', key: 'amountPaid', width: 14, style: { numFmt: INR_FORMAT } },
    { header: 'Ticket Numbers', key: 'ticketNumbers', width: 20 },
    { header: 'Checked In', key: 'checkedIn', width: 11 },
    { header: 'Check-in Details', key: 'checkInDetails', width: 34 },
  ];
  rows.forEach((row) => {
    const added = regSheet.addRow({
      registrationNumber: row.registrationNumber,
      type: row.type === 'competition' ? 'Rangoli/Drawing' : 'Dandiya Night',
      fullName: safeCell(row.fullName),
      gender: row.gender ? row.gender[0].toUpperCase() + row.gender.slice(1) : '',
      email: safeCell(row.email ?? ''),
      mobileNumber: safeCell(row.mobileNumber),
      address: safeCell(row.address),
      category: row.type === 'competition' ? '-' : row.category === 'couple' ? 'Couple' : 'Single',
      ticketQuantity: row.ticketQuantity,
      competitions: competitionLabel(row),
      createdAt: toIstWallClock(row.createdAt),
      paymentStatus: row.paymentStatus,
      totalAmount: paiseToRupees(row.totalAmountPaise),
      amountPaid: paiseToRupees(row.amountPaidPaise),
      ticketNumbers: row.ticketNumbers.join('\n'),
      checkedIn: `${row.checkIn.checkedIn}/${row.checkIn.total}`,
      checkInDetails: checkInDetails(row),
    });
    added.alignment = { vertical: 'top', wrapText: true };
  });
  styleSheet(regSheet);

  // Sheet 2: Payments
  const paySheet = workbook.addWorksheet('Payments');
  paySheet.columns = [
    { header: 'Registration No.', key: 'registrationNumber', width: 16 },
    { header: 'Razorpay Order ID', key: 'orderId', width: 24 },
    { header: 'Razorpay Payment ID', key: 'paymentId', width: 24 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Amount', key: 'amount', width: 14, style: { numFmt: INR_FORMAT } },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Verified At (IST)', key: 'verifiedAt', width: 22, style: { numFmt: DATE_FORMAT } },
    { header: 'Verified Via', key: 'verifiedVia', width: 12 },
    { header: 'Refund Required', key: 'requiresRefund', width: 15 },
  ];
  payments
    .filter((p) => registrationNumbers.has(p.registrationId))
    .sort((a, b) => a.registrationId.localeCompare(b.registrationId))
    .forEach((p) =>
      paySheet.addRow({
        registrationNumber: p.registrationId,
        orderId: p.razorpayOrderId,
        paymentId: p.razorpayPaymentId ?? '',
        status: p.status,
        amount: paiseToRupees(p.amountPaise),
        currency: p.currency,
        verifiedAt: toIstWallClock(p.verifiedAt),
        verifiedVia: p.verifiedVia ?? '',
        requiresRefund: p.requiresRefund ? 'YES' : '',
      }),
    );
  styleSheet(paySheet);

  // Sheet 3: Summary (derived from the same rows)
  const s = summarize(rows);
  const sumSheet = workbook.addWorksheet('Summary');
  sumSheet.columns = [
    { header: 'Metric', key: 'metric', width: 34 },
    { header: 'Value', key: 'value', width: 18 },
  ];
  [
    ['Total registrations', s.totalRegistrations],
    ['Dandiya Night registrations', s.dandiyaRegistrations],
    ['Rangoli/Drawing registrations', s.competitionRegistrations],
    ['Confirmed (successful payments)', s.confirmedRegistrations],
    ['Pending payments', s.pendingPayments],
    ['Failed payments', s.failedPayments],
    ['Cancelled payments', s.cancelledPayments],
    ['Dandiya tickets (confirmed)', s.totalTicketsBooked],
    ['Couple tickets', s.coupleTickets],
    ['Single tickets', s.singleTickets],
    ['Rangoli Competition participants', s.rangoliParticipants],
    ['Drawing Competition participants', s.drawingParticipants],
    ['Tickets checked in', s.ticketsCheckedIn],
    ['Tickets remaining', s.ticketsRemaining],
  ].forEach(([metric, value]) => sumSheet.addRow({ metric, value }));
  [
    ['Verified revenue (total)', s.verifiedRevenuePaise],
    ['Verified revenue - Dandiya Night', s.dandiyaRevenuePaise],
    ['Verified revenue - Rangoli/Drawing', s.competitionRevenuePaise],
  ].forEach(([metric, paise]) => {
    sumSheet.addRow({ metric, value: paiseToRupees(paise) }).getCell('value').numFmt = INR_FORMAT;
  });
  sumSheet.addRow({});
  sumSheet.addRow({ metric: 'Generated at (IST)', value: toIstWallClock(new Date()) }).getCell('value').numFmt = DATE_FORMAT;
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== undefined && v !== '');
  sumSheet.addRow({
    metric: 'Filters applied',
    value: safeCell(activeFilters.length ? activeFilters.map(([k, v]) => `${k}=${v}`).join('; ') : 'None (all records)'),
  });
  styleSheet(sumSheet);

  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), count: rows.length };
}
