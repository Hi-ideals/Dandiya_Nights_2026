import PDFDocument from 'pdfkit';
import { formatInr, formatIstDateTime } from '../utils/format.js';

const COLORS = {
  maroon: '#7a1035',
  saffron: '#f59e0b',
  pink: '#db2777',
  ink: '#1f2937',
  muted: '#6b7280',
  line: '#e5e7eb',
  green: '#15803d',
};

const PAGE = { size: 'A5', margin: 28 };

// Height of the poster's title area as a fraction of its width (poster is 1055 x 1491;
// "Team Agni ... Dandiya Nights" occupies roughly the top 31%, i.e. 0.44 of the width).
const POSTER_TITLE_BAND = 0.44;

function competitionsText(reg) {
  const list = [reg.rangoliSelected && 'Rangoli', reg.drawingSelected && 'Drawing'].filter(Boolean);
  return list.length ? list.join(' & ') : 'None';
}

function drawHeader(doc, event) {
  const { width } = doc.page;
  const headerHeight = 150;

  if (event.posterPath) {
    try {
      // Portrait poster: show its top band (organiser + "Dandiya Nights" title) uncropped
      // in width, then a strip with date/time below it.
      const bandHeight = Math.round(width * POSTER_TITLE_BAND);
      doc.save();
      doc.rect(0, 0, width, bandHeight).clip();
      doc.image(event.posterPath, 0, 0, { width });
      doc.restore();
      doc.rect(0, bandHeight, width, 28).fill(COLORS.maroon);
      doc
        .fillColor('#fde68a')
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(`${event.date}  |  ${event.time}`, 0, bandHeight + 9, { width, align: 'center', lineBreak: false });
      return bandHeight + 28;
    } catch {
      // Unreadable poster: fall through to the drawn header.
    }
  }

  // No poster: drawn festive header.
  doc.save();
  doc.rect(0, 0, width, headerHeight).clip();
  doc.rect(0, 0, width, headerHeight).fill(COLORS.maroon);
  doc.circle(width - 40, 30, 60).fillOpacity(0.25).fill(COLORS.saffron);
  doc.circle(30, headerHeight, 50).fillOpacity(0.25).fill(COLORS.pink);
  doc.restore();
  doc.fillColor('#fde68a').font('Helvetica-Bold').fontSize(11).text('ENTRY PASS', 28, 30, { characterSpacing: 3 });

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(event.name, 28, headerHeight - 46, { width: width - 56, lineBreak: false, ellipsis: true });
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .text(`${event.date}  |  ${event.time}`, 28, headerHeight - 20, { width: width - 56, lineBreak: false });

  return headerHeight;
}

function field(doc, label, value, x, y, width) {
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5).text(label.toUpperCase(), x, y, { width, characterSpacing: 0.5 });
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10.5).text(String(value ?? '-'), x, y + 10, { width });
}

function drawTicket(doc, { event, registration: reg, ticket }) {
  const { width, height } = doc.page;
  // Layout is absolute; stop PDFKit from auto-adding pages when drawing near the edge.
  doc.page.margins.bottom = 0;
  const left = 28;
  const contentWidth = width - 56;
  let y = drawHeader(doc, event) + 16;

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5).text(event.venue, left, y, { width: contentWidth });
  y += 22;

  // Ticket number banner
  doc.roundedRect(left, y, contentWidth, 40, 6).fill('#fff7ed');
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5).text('TICKET NUMBER', left + 12, y + 7);
  doc.fillColor(COLORS.maroon).font('Courier-Bold').fontSize(16).text(ticket.ticketNumber, left + 12, y + 18);
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(`Ticket ${ticket.index} of ${reg.ticketQuantity}`, left, y + 15, { width: contentWidth - 12, align: 'right' });
  y += 54;

  const qrSize = 150;
  const colWidth = contentWidth - qrSize - 14;
  const rowGap = 32;
  const rows = [
    ['Participant', reg.fullName],
    ['Mobile', `+91 ${reg.mobileNumber}`],
    ['Category', reg.category === 'couple' ? 'Couple (admits 2)' : 'Single (admits 1)'],
    ['Competitions', competitionsText(reg)],
    ['Registration No.', reg.registrationNumber],
  ];
  rows.forEach(([label, value], i) => field(doc, label, value, left, y + i * rowGap, colWidth));

  doc.image(ticket.qrPng, left + contentWidth - qrSize, y, { width: qrSize, height: qrSize });
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(7)
    .text('Show this QR code at the entry gate', left + contentWidth - qrSize, y + qrSize + 4, { width: qrSize, align: 'center' });
  y += rows.length * rowGap + 10;

  doc.moveTo(left, y).lineTo(left + contentWidth, y).dash(4, { space: 3 }).strokeColor(COLORS.line).stroke().undash();
  y += 12;

  doc.roundedRect(left, y, 118, 22, 11).fill('#dcfce7');
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(9).text('PAYMENT CONFIRMED', left, y + 7, { width: 118, align: 'center' });
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(8.5)
    .text(
      `Paid ${formatInr(reg.amountPaidPaise, { symbol: 'INR' })}  |  Ref ${reg.razorpayPaymentId}`,
      left + 128,
      y + 2,
      { width: contentWidth - 128 },
    )
    .fillColor(COLORS.muted)
    .fontSize(7.5)
    .text(`Booked ${formatIstDateTime(reg.paidAt ?? reg.createdAt)} IST`, left + 128, y + 13, { width: contentWidth - 128 });

  // Footer
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(7)
    .text(
      `Each ticket admits entry once. Organised by ${event.organizer}. Help: ${event.contactPhone} / ${event.contactEmail}`,
      left,
      height - 44,
      { width: contentWidth, align: 'center' },
    );
}

/** Renders one A5 page per ticket and resolves with the PDF bytes. */
export function renderTicketsPdf({ event, registration, tickets }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      ...PAGE,
      autoFirstPage: false,
      info: { Title: `${event.name} - ${registration.registrationNumber}`, Author: event.organizer },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    tickets.forEach((ticket) => {
      doc.addPage(PAGE);
      drawTicket(doc, { event, registration, ticket });
    });
    doc.end();
  });
}
