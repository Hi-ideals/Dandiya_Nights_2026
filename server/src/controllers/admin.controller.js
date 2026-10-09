import * as adminService from '../services/admin.service.js';
import { buildRegistrationsWorkbook } from '../services/excel.service.js';

export async function me(req, res) {
  res.json({ user: req.user });
}

export async function dashboard(_req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await adminService.getDashboard());
}

export async function listRegistrations(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await adminService.listRegistrations(req.valid.query));
}

export async function getRegistration(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await adminService.getRegistrationDetail(req.valid.params.registrationId));
}

export async function exportExcel(req, res) {
  const filters = req.valid.query;
  const { buffer } = await buildRegistrationsWorkbook(filters);
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = filters.paymentStatus ? `-${filters.paymentStatus}` : '';
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="dandiya-registrations${suffix}-${stamp}.xlsx"`,
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store',
  });
  res.send(buffer);
}
