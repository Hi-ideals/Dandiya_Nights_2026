import * as ticketService from '../services/ticket.service.js';

function sendPdf(res, buffer, filename) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store',
  });
  res.send(buffer);
}

export async function downloadTicket(req, res) {
  const { ticketNumber } = req.valid.params;
  sendPdf(res, await ticketService.getSingleTicketPdf(ticketNumber), `ticket-${ticketNumber}.pdf`);
}

export async function downloadBookingTickets(req, res) {
  const { registrationNumber } = req.valid.params;
  sendPdf(res, await ticketService.getBookingPdf(registrationNumber), `tickets-${registrationNumber}.pdf`);
}

export async function verifyTicket(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await ticketService.verifyTicket(req.valid.params.ticketNumber));
}

export async function checkIn(req, res) {
  res.json(await ticketService.checkInTicket(req.valid.params.ticketNumber, req.user));
}
