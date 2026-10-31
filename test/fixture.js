// Small realistic QMS fixture shared by the tests.
// - Press 4 weight-variation cluster: QMS-1, QMS-4, QMS-9 (target). CAPA QMS-5
//   is linked to QMS-1 and QMS-4 and closed before QMS-9 -> likely ineffective.
// - Blister B1 seal-integrity cluster: QMS-2, QMS-6. CAPA QMS-7 linked to
//   QMS-2, closed after QMS-6 -> effective when QMS-6 is analysed.
// - Noise: QMS-3, QMS-8, QMS-11; QMS-12 is a future Press 4 event.
// - SOPs: QMS-13 (SOP-012), QMS-14 (SOP-020).
import { extractKeywords } from '../src/core/extract.js';

let nextId = 100;
function ev(fields) {
  const issueId = String(++nextId);
  const text = `${fields.summary} ${fields.description || ''}`;
  return {
    issueId,
    projectId: '10000',
    description: '',
    equipment: null,
    product: null,
    failureMode: null,
    rootCause: null,
    keywords: extractKeywords(text),
    sopRef: null,
    ownerName: null,
    resolverName: null,
    closedDate: null,
    status: 'closed',
    isDemo: true,
    ...fields,
  };
}

export const events = [
  ev({ issueKey: 'QMS-1', kind: 'DEV', summary: 'Tablet weight out of spec on Press 4', description: 'In-process check found tablet weight drift high. Punch tips worn.', equipment: 'Press 4', product: 'Metformin 500 mg tablets', failureMode: 'Weight variation', rootCause: 'Tooling wear', sopRef: 'SOP-012', ownerName: 'Priya Natarajan', resolverName: 'Ravi Patel', eventDate: '2025-06-12', closedDate: '2025-07-01' }),
  ev({ issueKey: 'QMS-2', kind: 'DEV', summary: 'Blister seal integrity failure on Blister B1', description: 'Leak test failed on 3 cards. Seal temperature low.', equipment: 'Blister B1', product: 'Ibuprofen 200 mg tablets', failureMode: 'Seal integrity failure', rootCause: 'Calibration drift', sopRef: 'SOP-020', ownerName: 'Lena Fischer', resolverName: 'Tom Becker', eventDate: '2025-03-05', closedDate: '2025-03-20' }),
  ev({ issueKey: 'QMS-3', kind: 'DEV', summary: 'Autoclave A2 temperature excursion during cycle', description: 'Chamber probe read 2 C below setpoint.', equipment: 'Autoclave A2', product: 'Sterile saline 10 mL vials', failureMode: 'Temperature excursion', rootCause: 'Equipment malfunction', ownerName: 'Omar Haddad', resolverName: 'Omar Haddad', eventDate: '2025-09-14', closedDate: '2025-09-30' }),
  ev({ issueKey: 'QMS-4', kind: 'DEV', summary: 'Weight drift on Press 4, tablets underweight', description: 'Compression weight trending low; punch wear suspected.', equipment: 'Press 4', product: 'Metformin 500 mg tablets', failureMode: 'Weight variation', rootCause: 'Tooling wear', sopRef: 'SOP-012', ownerName: 'Anna Kowalski', resolverName: 'Ravi Patel', eventDate: '2025-11-03', closedDate: '2025-11-20' }),
  ev({ issueKey: 'QMS-5', kind: 'CAPA', summary: 'Replace punch tooling on Press 4 and add wear inspection', equipment: 'Press 4', ownerName: 'Meera Shah', resolverName: 'Meera Shah', eventDate: '2025-11-10', closedDate: '2026-01-20' }),
  ev({ issueKey: 'QMS-6', kind: 'DEV', summary: 'Seal integrity failure on Blister B1, weak seal', description: 'Leak test failed. Seal temperature drift found.', equipment: 'Blister B1', product: 'Ibuprofen 200 mg tablets', failureMode: 'Seal integrity failure', rootCause: 'Calibration drift', sopRef: 'SOP-020', ownerName: 'Lena Fischer', resolverName: 'Tom Becker', eventDate: '2025-04-20', closedDate: '2025-05-02' }),
  ev({ issueKey: 'QMS-7', kind: 'CAPA', summary: 'Recalibrate Blister B1 seal temperature controller', equipment: 'Blister B1', ownerName: 'Tom Becker', resolverName: 'Tom Becker', eventDate: '2025-04-25', closedDate: '2025-07-30' }),
  ev({ issueKey: 'QMS-8', kind: 'DEV', summary: 'Out-of-spec assay on HPLC-07', description: 'Amoxicillin assay result 93%.', equipment: 'HPLC-07', product: 'Amoxicillin 250 mg capsules', failureMode: 'Out-of-spec assay', rootCause: 'Operator error', ownerName: 'Grace Liu', resolverName: 'Grace Liu', eventDate: '2026-02-11', closedDate: '2026-02-25' }),
  ev({ issueKey: 'QMS-9', kind: 'DEV', summary: 'Tablet weight out of spec on Press 4 during compression', description: 'Weight check failed, batch B2291. Punch condition to be checked.', equipment: 'Press 4', product: 'Metformin 500 mg tablets', failureMode: 'Weight variation', sopRef: 'SOP-012', ownerName: 'Priya Natarajan', status: 'open', eventDate: '2026-09-10' }),
  ev({ issueKey: 'QMS-11', kind: 'DEV', summary: 'Tablet hardness out of spec on Press 2', description: 'Hardness low on Ibuprofen tablets.', equipment: 'Press 2', product: 'Ibuprofen 200 mg tablets', failureMode: 'Hardness out of spec', rootCause: 'Calibration drift', ownerName: 'Anna Kowalski', resolverName: 'Ravi Patel', eventDate: '2026-05-05', closedDate: '2026-05-19' }),
  ev({ issueKey: 'QMS-12', kind: 'DEV', summary: 'Tablet weight variation on Press 4 again', equipment: 'Press 4', product: 'Metformin 500 mg tablets', failureMode: 'Weight variation', sopRef: 'SOP-012', ownerName: 'Priya Natarajan', status: 'open', eventDate: '2026-10-01' }),
  ev({ issueKey: 'QMS-13', kind: 'SOP', summary: 'Tablet compression and in-process weight checks', sopRef: 'SOP-012', eventDate: '2025-11-02' }),
  ev({ issueKey: 'QMS-14', kind: 'SOP', summary: 'Blister sealing set-up and leak testing', sopRef: 'SOP-020', eventDate: '2024-05-10' }),
];

export const byKey = (key) => events.find((e) => e.issueKey === key);
const id = (key) => byKey(key).issueId;

export const links = [
  { capaIssueId: id('QMS-5'), devIssueId: id('QMS-1') },
  { capaIssueId: id('QMS-5'), devIssueId: id('QMS-4') },
  { capaIssueId: id('QMS-7'), devIssueId: id('QMS-2') },
];

export const NOW = '2026-10-31T12:00:00Z';
