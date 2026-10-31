// Demo dataset for Recurrence Radar: "Northwind Pharma", Riverside plant.
// Fictional company, people, batches and events. No real companies, no patient data.
//
// All dates are relative: `daysAgo` = days before the moment the admin clicks
// "Load demo QMS". The loader turns them into real dates.
//
// Planned stories:
//   1. Press 4 weight variation (hero): D16 (330), D18 (290) -> CAPA C01 opened 285,
//      closed 200 -> recurrences D29 (120) and D35 (45) -> live demo deviation.
//      Expected: HIGH, CAPA likely ineffective.
//   2. Line 2 sealer seal integrity: D04, D06, D09 -> C02 closed 400, no recurrence -> effective.
//   3. Supplier-lot particulate on Filler F1: D20, D27 -> C03 still open.
//   4. Autoclave A2 temperature excursions: D10, D13 -> C04 closed 280 -> D31 (95) -> ineffective.
//   5. Everything else is noise and near-misses (Press 2 hardness / weight, Press 4
//      hardness on Ibuprofen, Coater C3 particulate, insulin cold-chain excursion).

export const DEMO_META = { company: 'Northwind Pharma', site: 'Riverside plant' };

export const PEOPLE = [
  { id: 'p1', name: 'Ravi Patel', role: 'QA Engineer' },
  { id: 'p2', name: 'Priya Natarajan', role: 'QA Manager' },
  { id: 'p3', name: 'Tomasz Kowalczyk', role: 'Production Supervisor' },
  { id: 'p4', name: 'Amara Okafor', role: 'Validation Engineer' },
  { id: 'p5', name: 'Lucía Fernández', role: 'QC Microbiologist' },
  { id: 'p6', name: 'Kenji Watanabe', role: 'Maintenance Lead' },
];

const RAVI = 'Ravi Patel';
const PRIYA = 'Priya Natarajan';
const TOMASZ = 'Tomasz Kowalczyk';
const AMARA = 'Amara Okafor';
const LUCIA = 'Lucía Fernández';
const KENJI = 'Kenji Watanabe';

export const SOPS = [
  {
    localId: 'S1',
    sopRef: 'SOP-012',
    summary: 'SOP-012 Tablet compression — set-up and in-process checks',
    description:
      'Covers press set-up, tooling installation, and in-process checks for all rotary tablet presses (Press 2, Press 4). ' +
      'In-process checks: 20-tablet weight check every 15 min, hardness and thickness every 30 min, friability at start and end of batch. ' +
      'Alert limit ±3% of target weight, action limit ±5%. Tooling must be inspected against the punch log before each campaign.',
    daysAgo: 210,
  },
  {
    localId: 'S2',
    sopRef: 'SOP-021',
    summary: 'SOP-021 Blister packaging — sealing parameters and seal integrity testing',
    description:
      'Defines sealing temperature, dwell time and pressure windows for Blister B1 and the Line 2 sealer. ' +
      'Seal integrity verified by blue-dye vacuum leak test at start-up, every 2 h and after any stoppage over 15 min. ' +
      'Seal plate thermocouples are verified weekly against a calibrated reference probe (added in rev. 6).',
    daysAgo: 398,
  },
  {
    localId: 'S3',
    sopRef: 'SOP-034',
    summary: 'SOP-034 Aseptic vial filling — set-up, fill checks and interventions',
    description:
      'Covers Filler F1 set-up, component sterilisation in Autoclave A2, fill volume checks, stoppering and capping, and allowed aseptic interventions. ' +
      'Fill weight checked on 10 vials every 30 min. 100% visual inspection after capping. ' +
      'Incoming stopper and vial lots must have a released CoA before staging.',
    daysAgo: 240,
  },
  {
    localId: 'S4',
    sopRef: 'SOP-045',
    summary: 'SOP-045 Film coating — spray parameters and pan operation',
    description:
      'Defines coating suspension preparation, spray rate, atomising air, inlet air temperature and pan speed for Coater C3. ' +
      'Weight gain checked every 20 min against target 3.0% ±0.5%. Spray guns stripped and inspected after every campaign.',
    daysAgo: 95,
  },
  {
    localId: 'S5',
    sopRef: 'SOP-052',
    summary: 'SOP-052 Line clearance and label reconciliation',
    description:
      'Line clearance steps for packaging lines (Packaging Line 3, Blister B1) between batches, with second-person verification. ' +
      'Label reconciliation: issued, used, returned and destroyed counts must balance to zero before batch release. ' +
      'Rev. 9 added a barcode scan of the first and last label of each roll.',
    daysAgo: 125,
  },
  {
    localId: 'S6',
    sopRef: 'SOP-067',
    summary: 'SOP-067 Environmental monitoring — viable and non-viable sampling',
    description:
      'Sampling plan for Grade A/B areas: settle plates, contact plates, active air sampling and continuous non-viable particle counts. ' +
      'Alert and action limits per EU GMP Annex 1. Any Grade A action-level result triggers a deviation and batch impact assessment.',
    daysAgo: 520,
  },
];

// Deviation helper keeps the records compact and the field order the same.
function dev(localId, daysAgo, closedDaysAgo, f) {
  return {
    localId,
    summary: f.summary,
    description: f.description,
    equipment: f.equipment ?? null,
    product: f.product ?? null,
    failureMode: f.failureMode ?? null,
    rootCause: f.rootCause ?? null,
    sopRef: f.sopRef ?? null,
    ownerName: f.owner,
    resolverName: closedDaysAgo == null ? null : f.resolver,
    daysAgo,
    closedDaysAgo,
    comments: f.comments ?? [],
  };
}

export const DEVIATIONS = [
  dev('D01', 535, 505, {
    summary: 'Metformin granulate assay low after wet granulation, batch B1962',
    description:
      'Blend assay on granulate from Granulator G1 returned 94.1% LC against a 95.0–105.0% spec, batch B1962. ' +
      'Batch placed on QA hold. Investigation found the binder solution was made up to the old volume in the master batch record; the current revision had not been issued to the floor. ' +
      'Granulate reprocessed under a planned rework protocol and passed on retest (99.3% LC). No other batches affected.',
    equipment: 'Granulator G1', product: 'Metformin 500 mg tablets', failureMode: 'Out-of-spec assay',
    rootCause: 'Procedure gap', sopRef: null, owner: TOMASZ, resolver: PRIYA,
    comments: [{ author: PRIYA, body: 'Document control to confirm no other obsolete MBR copies are on the floor.' }],
  }),
  dev('D02', 520, 500, {
    summary: 'Wrong carton batch overprint found on Packaging Line 3, Amoxicillin batch B1971',
    description:
      'During end-of-line AQL check at 10:40, 3 cartons of Amoxicillin 250 mg capsules batch B1971 carried the overprint for B1968. ' +
      'Line stopped, 1,240 cartons segregated and 100% inspected; 46 cartons wrong. Leftover overprinted cartons from the previous batch were not removed at line clearance. ' +
      'Affected cartons destroyed and repacked. No product shipped.',
    equipment: 'Packaging Line 3', product: 'Amoxicillin 250 mg capsules', failureMode: 'Label mix-up',
    rootCause: 'Operator error', sopRef: 'SOP-052', owner: TOMASZ, resolver: RAVI,
  }),
  dev('D03', 510, 490, {
    summary: 'Ibuprofen tablet hardness above upper limit on Press 4, batch B1977',
    description:
      'In-process hardness readings on Press 4 trended to 162 N against a 90–150 N range during batch B1977 (Ibuprofen 200 mg). ' +
      'Compression force was within set-up values. Hardness tester HT-03 found 8% high on verification with reference weights; last calibration was 11 months earlier. ' +
      'Retained samples retested on HT-01 were all within range. Batch released after QA review.',
    equipment: 'Press 4', product: 'Ibuprofen 200 mg tablets', failureMode: 'Hardness out of spec',
    rootCause: 'Calibration drift', sopRef: 'SOP-012', owner: TOMASZ, resolver: RAVI,
    comments: [{ author: KENJI, body: 'HT-03 sent out for calibration, interval moved to 6 months.' }],
  }),
  dev('D04', 500, 480, {
    summary: 'Blister leak test failure on Line 2 sealer, Ibuprofen batch B1983',
    description:
      'Blue-dye leak test at 14:00 failed on 2 of 10 strips from the Line 2 sealer, batch B1983 (Ibuprofen 200 mg). ' +
      'Line stopped; output since the last passing test (approx. 18,000 blisters) quarantined. Seal plate display read 185 °C but the reference probe read 171 °C. ' +
      'Quarantined blisters 100% leak tested on a sample plan, 3 further failures, lot rejected.',
    equipment: 'Line 2 sealer', product: 'Ibuprofen 200 mg tablets', failureMode: 'Seal integrity failure',
    rootCause: 'Calibration drift', sopRef: 'SOP-021', owner: TOMASZ, resolver: KENJI,
  }),
  dev('D05', 485, 478, {
    summary: 'Missing blend time entries in Mixer M2 batch record, Metformin batch B1990',
    description:
      'QA batch record review found blank blend start/stop time fields for Mixer M2, batch B1990. ' +
      'Mixer PLC log confirms a 12 min blend as specified. Operator was new to the line and had not completed the GDP module. ' +
      'Late entry made with justification and PLC printout attached. No product impact.',
    equipment: 'Mixer M2', product: 'Metformin 500 mg tablets', failureMode: 'Documentation error',
    rootCause: 'Training gap', sopRef: null, owner: RAVI, resolver: RAVI,
  }),
  dev('D06', 470, 455, {
    summary: 'Channel leaks in Ibuprofen blisters after restart, Line 2 sealer',
    description:
      'After a 40 min stoppage for a foil splice, the restart leak test on the Line 2 sealer failed (1 of 10 strips), batch B2001. ' +
      'Seal temperature on the HMI was in range. Maintenance found the lower thermocouple reading 12 °C high against the reference probe. ' +
      'Approx. 6,500 blisters since restart rejected. Thermocouple replaced and line re-verified before restart.',
    equipment: 'Line 2 sealer', product: 'Ibuprofen 200 mg tablets', failureMode: 'Seal integrity failure',
    rootCause: 'Calibration drift', sopRef: 'SOP-021', owner: TOMASZ, resolver: KENJI,
    comments: [{ author: RAVI, body: 'Second event in a month on this sealer. Flagging for CAPA review.' }],
  }),
  dev('D07', 455, 430, {
    summary: 'Grade A settle plate action-level count during saline vial fill, Filler F1',
    description:
      'Settle plate at the Filler F1 stopper bowl showed 2 CFU (action limit 1) for batch B2008, Sterile saline 10 mL vials. ' +
      'Organism identified as Micrococcus luteus (skin flora). Review found an extended manual intervention to clear a stopper jam at 03:15. ' +
      'Batch impact assessment: media fill coverage and sterility test passed, batch released with QA justification.',
    equipment: 'Filler F1', product: 'Sterile saline 10 mL vials', failureMode: 'Environmental monitoring excursion',
    rootCause: 'Environmental control', sopRef: 'SOP-067', owner: LUCIA, resolver: LUCIA,
  }),
  dev('D08', 440, 400, {
    summary: 'Ibuprofen coated tablets fail dissolution at 30 min, batch B2015',
    description:
      'Stage 1 dissolution for batch B2015 (Ibuprofen 200 mg, coated on Coater C3) gave 71–78% at 30 min against Q=80%. ' +
      'Stage 2 also failed. Coating weight gain recorded as 4.6% against a 3.0% target; SOP-045 did not define an upper stop limit for weight gain. ' +
      'Batch rejected. Retained cores tested fine, confirming the coat as the cause.',
    equipment: 'Coater C3', product: 'Ibuprofen 200 mg tablets', failureMode: 'Dissolution failure',
    rootCause: 'Procedure gap', sopRef: 'SOP-045', owner: RAVI, resolver: AMARA,
  }),
  dev('D09', 430, 418, {
    summary: 'Line 2 sealer leak test fail at start-up, Ibuprofen batch B2019',
    description:
      'Start-up leak test failed on 3 of 10 strips, batch B2019. No product made before the test, so no batch impact. ' +
      'Upper seal plate found 9 °C below indicated temperature against the reference probe. Thermocouples recalibrated by maintenance and start-up test repeated and passed. ' +
      'Third seal failure on this sealer in ~10 weeks.',
    equipment: 'Line 2 sealer', product: 'Ibuprofen 200 mg tablets', failureMode: 'Seal integrity failure',
    rootCause: 'Calibration drift', sopRef: 'SOP-021', owner: TOMASZ, resolver: KENJI,
  }),
  dev('D10', 415, 395, {
    summary: 'Autoclave A2 cycle aborted on low sterilisation temperature, saline component load',
    description:
      'Autoclave A2 load L-0417 (stoppers and filling parts for Sterile saline batch B2024) aborted at 7 min of hold when the drain probe read 119.2 °C (min 121.0 °C). ' +
      'Load quarantined and re-run after maintenance. Steam trap on the drain line found partly blocked. ' +
      'Filling for B2024 delayed 6 h. No non-sterile parts used.',
    equipment: 'Autoclave A2', product: 'Sterile saline 10 mL vials', failureMode: 'Temperature excursion',
    rootCause: 'Equipment malfunction', sopRef: 'SOP-034', owner: AMARA, resolver: KENJI,
  }),
  dev('D11', 400, 390, {
    summary: 'Low hardness on Metformin tablets at start of batch, Press 2',
    description:
      'First hardness check on Press 2 for batch B2031 (Metformin 500 mg) averaged 68 N against 80–120 N. ' +
      'Operator had set main compression force from the previous product recipe. Press stopped, force corrected, and 4.2 kg of start-up tablets rejected. ' +
      'All later checks in range. Operator retrained on recipe selection.',
    equipment: 'Press 2', product: 'Metformin 500 mg tablets', failureMode: 'Hardness out of spec',
    rootCause: 'Operator error', sopRef: 'SOP-012', owner: TOMASZ, resolver: RAVI,
  }),
  dev('D12', 385, 380, {
    summary: 'Line clearance checklist not countersigned, insulin cartridge packing',
    description:
      'Batch record review for insulin pen cartridges batch B2037 found the Packaging Line 3 line clearance checklist signed by the operator but not by the second verifier. ' +
      'CCTV and the shift log confirm clearance was done. Verifier was called away to another line. ' +
      'Late countersignature with justification. No product impact.',
    equipment: 'Packaging Line 3', product: 'Insulin pen cartridges', failureMode: 'Documentation error',
    rootCause: 'Operator error', sopRef: 'SOP-052', owner: RAVI, resolver: RAVI,
  }),
  dev('D13', 350, 335, {
    summary: 'Autoclave A2 hold temperature dipped below 121 °C during component cycle',
    description:
      'Load L-0502 for Sterile saline batch B2061: chamber probe dipped to 120.4 °C for 40 s at minute 9 of hold. Cycle did not abort because the alarm delay was set to 60 s. ' +
      'Load rejected and re-sterilised. Steam trap again found partly blocked; same trap as the event in L-0417. ' +
      'Batch B2061 filled with re-sterilised parts, no impact.',
    equipment: 'Autoclave A2', product: 'Sterile saline 10 mL vials', failureMode: 'Temperature excursion',
    rootCause: 'Equipment malfunction', sopRef: 'SOP-034', owner: AMARA, resolver: KENJI,
    comments: [{ author: AMARA, body: 'Repeat of the L-0417 event. Raising a CAPA, the alarm delay also needs review.' }],
  }),
  dev('D14', 360, 345, {
    summary: 'Saline vial fill volume low on two needles, Filler F1, batch B2055',
    description:
      'In-process fill weight check at 11:30 on Filler F1 showed needles 3 and 7 filling 9.6 mL against 10.0–10.4 mL, batch B2055. ' +
      'Fill line stopped. Pump calibration on those stations found drifted. Vials since the last good check (approx. 2,400) rejected. ' +
      'Pumps recalibrated, fill checks increased to every 15 min for the rest of the batch.',
    equipment: 'Filler F1', product: 'Sterile saline 10 mL vials', failureMode: 'Fill volume deviation',
    rootCause: 'Calibration drift', sopRef: 'SOP-034', owner: TOMASZ, resolver: AMARA,
  }),
  dev('D15', 345, 320, {
    summary: 'Black specks on Metformin film-coated tablets from Coater C3',
    description:
      'Visual inspection of batch B2064 (Metformin 500 mg, coated on Coater C3) found dark specks on approx. 0.3% of tablets. ' +
      'Specks matched the material of the spray gun gasket, which was found cracked at strip-down. ' +
      'Batch 100% optically sorted; 1.9 kg rejected. Gasket replaced, inspection added to post-campaign strip-down.',
    equipment: 'Coater C3', product: 'Metformin 500 mg tablets', failureMode: 'Particulate contamination',
    rootCause: 'Equipment malfunction', sopRef: 'SOP-045', owner: TOMASZ, resolver: AMARA,
  }),
  // Story 1, event 1
  dev('D16', 330, 318, {
    summary: 'Metformin tablet weights drifting high on Press 4, batch B2104',
    description:
      'At 09:45 the in-process weight check on Press 4 averaged 1,028 mg against a 1,000 mg target (action limit ±5%), batch B2104, Metformin 500 mg. ' +
      'Two individual tablets above 1,060 mg. Press stopped and tablets since the last good check (approx. 38,000) segregated. ' +
      'Upper punches stations 11 and 14 showed visible tip wear on inspection. Segregated tablets 100% weight sorted; batch released after QA review.',
    equipment: 'Press 4', product: 'Metformin 500 mg tablets', failureMode: 'Weight variation',
    rootCause: 'Tooling wear', sopRef: 'SOP-012', owner: TOMASZ, resolver: RAVI,
    comments: [{ author: RAVI, body: 'Worn punches replaced from spares. Punch set is at ~1.9M compressions, no wear limit in the punch log.' }],
  }),
  dev('D17', 315, 300, {
    summary: 'Ibuprofen label roll from previous batch found on Packaging Line 3',
    description:
      'At batch start for B2112 (Ibuprofen 200 mg), the second verifier found a part-used label roll for batch B2109 in the label magazine of Packaging Line 3. ' +
      'Caught before any labels were applied. SOP-052 checklist did not list the label magazine as a check point. ' +
      'Roll removed and reconciled. No product impact.',
    equipment: 'Packaging Line 3', product: 'Ibuprofen 200 mg tablets', failureMode: 'Label mix-up',
    rootCause: 'Procedure gap', sopRef: 'SOP-052', owner: TOMASZ, resolver: PRIYA,
  }),
  // Story 1, event 2
  dev('D18', 290, 283, {
    summary: 'Tablet weight variation on Press 4 during Metformin compression, batch B2131',
    description:
      'Weight check at 15:20 on Press 4 failed: 3 of 20 tablets outside ±5% (high 1,071 mg), batch B2131, Metformin 500 mg. ' +
      'Press stopped and approx. 52,000 tablets segregated. Upper punches stations 3, 11 and 22 worn at the tip edge; same punch set as the event on B2104. ' +
      'Segregated tablets weight sorted, 6.1 kg rejected. Second weight event on Press 4 in about 6 weeks.',
    equipment: 'Press 4', product: 'Metformin 500 mg tablets', failureMode: 'Weight variation',
    rootCause: 'Tooling wear', sopRef: 'SOP-012', owner: TOMASZ, resolver: RAVI,
    comments: [
      { author: RAVI, body: 'Recommend full punch set replacement and a wear check in SOP-012. Raising CAPA.' },
      { author: PRIYA, body: 'Agreed. I will own the CAPA.' },
    ],
  }),
  dev('D19', 275, 250, {
    summary: 'Amoxicillin capsule blend fails uniformity, Mixer M2, batch B2140',
    description:
      'Blend uniformity sampling from Mixer M2 for batch B2140 (Amoxicillin 250 mg capsules) gave RSD 7.8% (limit 5.0%), with one location at 88% LC. ' +
      'Mixer found running at 9 rpm instead of 14 rpm; drive belt slipping. ' +
      'Batch held, re-blended under a planned rework and passed (RSD 2.1%). Belt replaced.',
    equipment: 'Mixer M2', product: 'Amoxicillin 250 mg capsules', failureMode: 'Out-of-spec assay',
    rootCause: 'Equipment malfunction', sopRef: null, owner: RAVI, resolver: KENJI,
  }),
  // Story 3, event 1
  dev('D20', 260, 240, {
    summary: 'Visible particles in saline vials at 100% inspection, Filler F1, batch B2147',
    description:
      '100% visual inspection of Sterile saline 10 mL batch B2147 rejected 0.42% of vials for visible particles (alert 0.15%). ' +
      'Particles identified by FTIR as bromobutyl rubber fragments matching stopper lot ST-7741 from the stopper supplier. ' +
      'Batch rejected. Remaining stock of lot ST-7741 quarantined and supplier complaint SC-118 raised.',
    equipment: 'Filler F1', product: 'Sterile saline 10 mL vials', failureMode: 'Particulate contamination',
    rootCause: 'Supplier material', sopRef: 'SOP-034', owner: LUCIA, resolver: AMARA,
    comments: [{ author: AMARA, body: 'Supplier confirms a die change on their side around that lot. Awaiting their 8D.' }],
  }),
  dev('D21', 245, 230, {
    summary: 'Seal temperature entries missing in Blister B1 batch record, Amoxicillin B2152',
    description:
      'QA review of batch B2152 (Amoxicillin 250 mg capsules) found 2-hourly seal temperature entries missing for Blister B1 between 22:00 and 04:00. ' +
      'Machine data log confirms temperature stayed in range. Night-shift operator had not been trained on the revised batch record page. ' +
      'Late entries with log printout attached. No product impact.',
    equipment: 'Blister B1', product: 'Amoxicillin 250 mg capsules', failureMode: 'Documentation error',
    rootCause: 'Training gap', sopRef: 'SOP-021', owner: RAVI, resolver: RAVI,
  }),
  dev('D22', 230, 215, {
    summary: 'Ibuprofen tablet weight swings on Press 2 after feeder fault',
    description:
      'Press 2 feed frame paddle stalled intermittently during batch B2160 (Ibuprofen 200 mg), causing weight swings of ±6% for about 10 min before the automatic reject gate caught it. ' +
      'Tablets in that window (approx. 9,000) rejected. Feeder motor coupling found loose. ' +
      'Coupling tightened and checked; added to the Press 2 PM checklist.',
    equipment: 'Press 2', product: 'Ibuprofen 200 mg tablets', failureMode: 'Weight variation',
    rootCause: 'Equipment malfunction', sopRef: 'SOP-012', owner: TOMASZ, resolver: KENJI,
  }),
  dev('D23', 215, 200, {
    summary: 'Metformin batch B2168 slow dissolution traced to over-granulation in G1',
    description:
      'Dissolution for Metformin 500 mg batch B2168 passed at stage 2 only (mean 81% at 30 min). ' +
      'Granulator G1 power curve showed end-point reached 90 s early but granulation continued to the fixed time in the batch record. ' +
      'Batch released after stage 2 pass. Batch record changed to stop on power end-point, with fixed time as a maximum.',
    equipment: 'Granulator G1', product: 'Metformin 500 mg tablets', failureMode: 'Dissolution failure',
    rootCause: 'Procedure gap', sopRef: null, owner: RAVI, resolver: AMARA,
  }),
  dev('D24', 200, 190, {
    summary: 'Loose crimp caps on saline vials, Filler F1 capping station',
    description:
      'Cap removal torque check on Sterile saline batch B2175 found 4 of 50 vials with loose crimps. ' +
      'Capping head 2 on Filler F1 had a worn cam roller. Vials since the last good check (approx. 3,100) rejected. ' +
      'Cam roller replaced and capping re-verified. Remaining batch passed 100% visual and torque sampling.',
    equipment: 'Filler F1', product: 'Sterile saline 10 mL vials', failureMode: 'Capping defect',
    rootCause: 'Equipment malfunction', sopRef: 'SOP-034', owner: TOMASZ, resolver: KENJI,
  }),
  dev('D25', 185, 175, {
    summary: 'Metformin bottles labelled with expiry from previous batch, Packaging Line 3',
    description:
      'Customer-facing label check at 13:10 found expiry 08/2028 printed instead of 09/2028 on Metformin 500 mg batch B2181, Packaging Line 3. ' +
      'Online printer had kept the previous batch job; line clearance did not include a printer job check. ' +
      'Line stopped, 2,880 bottles relabelled under supervision. Second Line 3 label event in about 4 months.',
    equipment: 'Packaging Line 3', product: 'Metformin 500 mg tablets', failureMode: 'Label mix-up',
    rootCause: 'Procedure gap', sopRef: 'SOP-052', owner: TOMASZ, resolver: PRIYA,
  }),
  dev('D26', 170, 150, {
    summary: 'Ibuprofen coated batch B2190 fails dissolution stage 1, Coater C3',
    description:
      'Stage 1 dissolution failed (75–83% at 30 min, Q=80%) on Ibuprofen 200 mg batch B2190 coated on Coater C3. ' +
      'Spray rate log showed 18% above set point for the second half of the run; the suspension flowmeter had drifted. ' +
      'Batch passed stage 2 and was released after QA review. Flowmeter recalibrated.',
    equipment: 'Coater C3', product: 'Ibuprofen 200 mg tablets', failureMode: 'Dissolution failure',
    rootCause: 'Calibration drift', sopRef: 'SOP-045', owner: RAVI, resolver: AMARA,
  }),
  // Story 3, event 2 (CAPA C03 still open)
  dev('D27', 150, 138, {
    summary: 'Rubber particles again in Sterile saline vials, batch B2203',
    description:
      'Visual inspection rejects for particles reached 0.31% on Sterile saline 10 mL batch B2203 filled on Filler F1. ' +
      'Stopper lot ST-7790 from the same supplier; particles again matched bromobutyl rubber. ' +
      'Batch rejected. All stopper lots from this supplier placed on hold pending CAPA C03 actions.',
    equipment: 'Filler F1', product: 'Sterile saline 10 mL vials', failureMode: 'Particulate contamination',
    rootCause: 'Supplier material', sopRef: 'SOP-034', owner: LUCIA, resolver: AMARA,
    comments: [{ author: PRIYA, body: 'Second lot from this supplier. Escalating to supplier quality, second source qualification to be pulled forward.' }],
  }),
  dev('D28', 140, 135, {
    summary: 'Wrong batch number written on Mixer M2 weigh sheet, Metformin',
    description:
      'Weigh sheet for Mixer M2 charge carried batch B2207 instead of B2209 (Metformin 500 mg). ' +
      'Caught at in-line QA check before charging. Materials confirmed correct by barcode scan. Corrected with single-line strike and initials. No product impact.',
    equipment: 'Mixer M2', product: 'Metformin 500 mg tablets', failureMode: 'Documentation error',
    rootCause: 'Operator error', sopRef: null, owner: RAVI, resolver: RAVI,
  }),
  // Story 1, recurrence 1 after CAPA C01 closed
  dev('D29', 120, 110, {
    summary: 'Press 4 weight check out of limits on Metformin batch B2238',
    description:
      'Weight check at 06:30 on Press 4 averaged 1,041 mg (target 1,000 mg), with 2 of 20 tablets above the action limit, batch B2238, Metformin 500 mg. ' +
      'Press stopped and approx. 44,000 tablets segregated. Punch-wear inspection from CAPA C01 was signed off at campaign start, but stations 6 and 19 showed tip wear at strip-down. ' +
      'Segregated tablets weight sorted, 3.4 kg rejected. Batch released after QA review.',
    equipment: 'Press 4', product: 'Metformin 500 mg tablets', failureMode: 'Weight variation',
    rootCause: 'Tooling wear', sopRef: 'SOP-012', owner: TOMASZ, resolver: RAVI,
    comments: [{ author: RAVI, body: 'New punch set is only ~4 months old. Wear check is visual only, may not catch early tip wear.' }],
  }),
  dev('D30', 105, 90, {
    summary: 'Insulin cartridge cold room above 8 °C for 3 h overnight',
    description:
      'Cold room CR-2 holding insulin pen cartridges (batches B2241, B2244) reached 9.6 °C between 01:10 and 04:05. ' +
      'Alarm went to an out-of-date on-call number. Compressor restarted by facilities at 04:00. ' +
      'Stability data supports up to 24 h at 8–25 °C; QA released both batches with justification. On-call list updated.',
    equipment: null, product: 'Insulin pen cartridges', failureMode: 'Temperature excursion',
    rootCause: 'Environmental control', sopRef: null, owner: LUCIA, resolver: PRIYA,
  }),
  // Story 4, recurrence after CAPA C04 closed
  dev('D31', 95, 80, {
    summary: 'Autoclave A2 temperature excursion on component load for saline batch B2250',
    description:
      'Load L-0688 for Sterile saline batch B2250: drain probe fell to 120.1 °C for 75 s during hold. Cycle aborted correctly under the new alarm delay. ' +
      'Steam trap was replaced under CAPA C04, but the new trap was found partly blocked by debris from the steam supply. ' +
      'Load re-run after the trap was cleaned. Filling delayed 5 h, no product impact.',
    equipment: 'Autoclave A2', product: 'Sterile saline 10 mL vials', failureMode: 'Temperature excursion',
    rootCause: 'Equipment malfunction', sopRef: 'SOP-034', owner: AMARA, resolver: KENJI,
    comments: [{ author: KENJI, body: 'Strainer upstream of the trap is the real fix. Plant steam quality to be checked.' }],
  }),
  dev('D32', 80, 70, {
    summary: 'Metformin tablet hardness readings high on Press 2, batch B2259',
    description:
      'Hardness checks on Press 2 read 128–135 N against 80–120 N on batch B2259 (Metformin 500 mg). Thickness and weight in range. ' +
      'Hardness tester HT-01 read 11% high against reference. Samples retested on a verified tester were within range. ' +
      'HT-01 recalibrated. Batch released.',
    equipment: 'Press 2', product: 'Metformin 500 mg tablets', failureMode: 'Hardness out of spec',
    rootCause: 'Calibration drift', sopRef: 'SOP-012', owner: TOMASZ, resolver: RAVI,
  }),
  dev('D33', 70, 50, {
    summary: 'Non-viable particle count above Grade A limit at Filler F1 fill zone',
    description:
      'Continuous particle counter at the Filler F1 fill needles logged 0.5 µm counts of 4,100/m³ (limit 3,520) for 4 min at 21:40 during Sterile saline batch B2265. ' +
      'Excursion lined up with a door being propped open in the Grade B corridor during a material transfer. ' +
      'Settle plates and air samples for the shift were clean. Batch released with QA impact assessment.',
    equipment: 'Filler F1', product: 'Sterile saline 10 mL vials', failureMode: 'Environmental monitoring excursion',
    rootCause: 'Environmental control', sopRef: 'SOP-067', owner: LUCIA, resolver: LUCIA,
  }),
  dev('D34', 60, 52, {
    summary: 'Label reconciliation does not balance, Amoxicillin batch B2270',
    description:
      'Label reconciliation for Amoxicillin 250 mg capsules batch B2270 on Packaging Line 3 was out by 12 labels. ' +
      'Labels found in the reject bin and not counted; operator unaware the reject bin counts as returned. ' +
      'Reconciliation corrected to zero. No mislabelled product.',
    equipment: 'Packaging Line 3', product: 'Amoxicillin 250 mg capsules', failureMode: 'Documentation error',
    rootCause: 'Training gap', sopRef: 'SOP-052', owner: RAVI, resolver: RAVI,
  }),
  // Story 1, recurrence 2 after CAPA C01 closed
  dev('D35', 45, 35, {
    summary: 'High tablet weights on Press 4 mid-run, Metformin batch B2276',
    description:
      'Automatic weight control on Press 4 alarmed at 11:05; manual check averaged 1,034 mg against 1,000 mg target, batch B2276, Metformin 500 mg. ' +
      'Press stopped and approx. 29,000 tablets segregated. Punches checked and within the new wear limit; weight control load cell found reading 2.8% low against reference weights. ' +
      'Load cell recalibrated. Segregated tablets weight sorted, 2.2 kg rejected.',
    equipment: 'Press 4', product: 'Metformin 500 mg tablets', failureMode: 'Weight variation',
    rootCause: 'Calibration drift', sopRef: 'SOP-012', owner: TOMASZ, resolver: RAVI,
    comments: [{ author: TOMASZ, body: 'Fourth weight problem on this press this year. Operators are starting to lose trust in the auto weight control.' }],
  }),
  dev('D36', 35, 28, {
    summary: 'Granulator G1 cleaning log not signed before Metformin campaign start',
    description:
      'Pre-use check for Metformin 500 mg batch B2280 found the Granulator G1 cleaning log from the previous Ibuprofen campaign signed by the cleaner but not verified. ' +
      'Visual inspection and swab results on file were acceptable. Verifier signed late with justification. No product impact.',
    equipment: 'Granulator G1', product: 'Metformin 500 mg tablets', failureMode: 'Documentation error',
    rootCause: 'Operator error', sopRef: null, owner: RAVI, resolver: RAVI,
  }),
  dev('D37', 25, null, {
    summary: 'Cartridge crimp caps failing pull test on Filler F1, insulin batch B2284',
    description:
      'Pull test on insulin pen cartridges batch B2284 found 3 of 32 crimp caps below the 25 N minimum, all from capping head 4 on Filler F1. ' +
      'Filling stopped, cartridges since the last good check (approx. 4,600) quarantined. ' +
      'Initial check shows crimp head pressure regulator unstable. Investigation ongoing.',
    equipment: 'Filler F1', product: 'Insulin pen cartridges', failureMode: 'Capping defect',
    rootCause: 'Equipment malfunction', sopRef: 'SOP-034', owner: TOMASZ, resolver: null,
    comments: [{ author: KENJI, body: 'Spare regulator ordered, ETA Thursday. Head 4 locked out until then.' }],
  }),
  dev('D38', 15, null, {
    summary: 'Ibuprofen tablet hardness out of range on Press 2, batch B2287',
    description:
      'Hardness checks on Press 2 for Ibuprofen 200 mg batch B2287 read 152–158 N against 90–150 N from 14:00 onward. ' +
      'Tablets since the last good check segregated (approx. 21,000). Tester verified OK. Pre-compression force reading looks unstable; force transducer suspected. ' +
      'Investigation ongoing.',
    equipment: 'Press 2', product: 'Ibuprofen 200 mg tablets', failureMode: 'Hardness out of spec',
    rootCause: 'Calibration drift', sopRef: 'SOP-012', owner: TOMASZ, resolver: null,
  }),
  dev('D39', 9, null, {
    summary: 'Amoxicillin blend assay low, Mixer M2, batch B2289',
    description:
      'Blend assay for Amoxicillin 250 mg capsules batch B2289 from Mixer M2 returned 93.6% LC (spec 95.0–105.0%). ' +
      'Batch on QA hold. Mixer speed and time confirmed correct this time. API lot A-5521 is from a new manufacturing site at the supplier; CoA potency at the low end. ' +
      'Retest of API lot requested.',
    equipment: 'Mixer M2', product: 'Amoxicillin 250 mg capsules', failureMode: 'Out-of-spec assay',
    rootCause: null, sopRef: null, owner: RAVI, resolver: null,
  }),
  dev('D40', 4, null, {
    summary: 'Line clearance record incomplete on Packaging Line 3 for saline vial batch B2290',
    description:
      'Line clearance record for Sterile saline 10 mL batch B2290 on Packaging Line 3 had the "previous batch materials removed" step left blank. ' +
      'Supervisor walked the line and confirmed it clear before start. Operator and verifier interviews pending.',
    equipment: 'Packaging Line 3', product: 'Sterile saline 10 mL vials', failureMode: 'Documentation error',
    rootCause: null, sopRef: 'SOP-052', owner: RAVI, resolver: null,
  }),
];

function capa(localId, daysAgo, closedDaysAgo, f) {
  return {
    localId,
    summary: f.summary,
    description: f.description,
    equipment: f.equipment ?? null,
    product: f.product ?? null,
    failureMode: f.failureMode ?? null,
    rootCause: f.rootCause ?? null,
    sopRef: f.sopRef ?? null,
    ownerName: f.owner,
    resolverName: closedDaysAgo == null ? null : f.resolver,
    daysAgo,
    closedDaysAgo,
    linkedDeviations: f.links,
  };
}

export const CAPAS = [
  // Story 1: closed ~200 days ago, then D29 and D35 happen -> likely ineffective
  capa('C01', 285, 200, {
    summary: 'CAPA: Replace Press 4 upper punches and add punch-wear inspection',
    description:
      'Trigger: two weight variation events on Press 4 (Metformin 500 mg, batches B2104 and B2131), both traced to worn upper punch tips.\n' +
      'Actions:\n' +
      '1. Replace full upper and lower punch set on Press 4 (done, new set PN-4471).\n' +
      '2. Add a visual punch-wear inspection at campaign start to SOP-012 rev. 14, with a wear limit of 2.0M compressions in the punch log.\n' +
      '3. Train all press operators on the new inspection (14 of 14 trained).\n' +
      'Effectiveness check: no Press 4 weight variation events over 3 Metformin campaigns after closure. Check done at closure on 3 campaigns: no events. CAPA closed effective.',
    equipment: 'Press 4', product: 'Metformin 500 mg tablets', failureMode: 'Weight variation',
    rootCause: 'Tooling wear', sopRef: 'SOP-012', owner: PRIYA, resolver: PRIYA,
    links: ['D16', 'D18'],
  }),
  // Story 2: closed ~400 days ago, no recurrence -> effective
  capa('C02', 425, 400, {
    summary: 'CAPA: Weekly seal plate thermocouple verification on Line 2 sealer',
    description:
      'Trigger: three seal integrity failures on the Line 2 sealer in ~10 weeks (Ibuprofen 200 mg), each with seal plate thermocouples reading off against a reference probe.\n' +
      'Actions:\n' +
      '1. Replace both seal plate thermocouples with a higher-stability type.\n' +
      '2. Add weekly verification against a calibrated reference probe to SOP-021 rev. 6, with ±3 °C tolerance.\n' +
      '3. Add seal temperature trending to the line HMI.\n' +
      'Effectiveness check: zero seal integrity failures on the Line 2 sealer for 6 months and weekly verification records complete. Interim check at 90 days passed.',
    equipment: 'Line 2 sealer', product: 'Ibuprofen 200 mg tablets', failureMode: 'Seal integrity failure',
    rootCause: 'Calibration drift', sopRef: 'SOP-021', owner: KENJI, resolver: KENJI,
    links: ['D04', 'D06', 'D09'],
  }),
  // Story 3: still open
  capa('C03', 255, null, {
    summary: 'CAPA: Stopper supplier particulate control and second-source qualification',
    description:
      'Trigger: rubber particles in Sterile saline 10 mL vials from stopper lots ST-7741 and ST-7790 (same supplier).\n' +
      'Actions:\n' +
      '1. Supplier 8D on die change and trimming process (received, under review).\n' +
      '2. Add incoming particle inspection on 200 stoppers per lot until 10 clean lots in a row.\n' +
      '3. Qualify a second stopper source (validation protocol VP-219 in progress).\n' +
      'Effectiveness check planned: visual inspection particle rejects below 0.15% for 10 consecutive batches after second source go-live.',
    equipment: 'Filler F1', product: 'Sterile saline 10 mL vials', failureMode: 'Particulate contamination',
    rootCause: 'Supplier material', sopRef: 'SOP-034', owner: AMARA, resolver: null,
    links: ['D20', 'D27'],
  }),
  // Story 4: closed ~280 days ago, then D31 -> likely ineffective
  capa('C04', 345, 280, {
    summary: 'CAPA: Replace Autoclave A2 drain steam trap and reduce alarm delay',
    description:
      'Trigger: two low-temperature events on Autoclave A2 component loads (L-0417, L-0502), both from a partly blocked drain steam trap.\n' +
      'Actions:\n' +
      '1. Replace the drain steam trap.\n' +
      '2. Cut the low-temperature alarm delay from 60 s to 15 s (change control CC-0931).\n' +
      '3. Add steam trap check to the quarterly PM.\n' +
      'Effectiveness check: no temperature excursions on Autoclave A2 for 3 months after closure. Passed at 3 months.',
    equipment: 'Autoclave A2', product: 'Sterile saline 10 mL vials', failureMode: 'Temperature excursion',
    rootCause: 'Equipment malfunction', sopRef: 'SOP-034', owner: KENJI, resolver: KENJI,
    links: ['D10', 'D13'],
  }),
  capa('C05', 180, 120, {
    summary: 'CAPA: Add label magazine and printer job checks to Packaging Line 3 line clearance',
    description:
      'Trigger: label events on Packaging Line 3 (previous-batch label roll left in the magazine; previous-batch expiry left in the printer).\n' +
      'Actions:\n' +
      '1. Add label magazine, reject bin and online printer job to the SOP-052 checklist (rev. 9).\n' +
      '2. Barcode scan of first and last label of each roll.\n' +
      '3. Retrain packaging operators and verifiers.\n' +
      'Effectiveness check: no label mix-ups on Packaging Line 3 for 3 months. Passed.',
    equipment: 'Packaging Line 3', product: 'Metformin 500 mg tablets', failureMode: 'Label mix-up',
    rootCause: 'Procedure gap', sopRef: 'SOP-052', owner: PRIYA, resolver: PRIYA,
    links: ['D17', 'D25'],
  }),
  capa('C06', 165, 90, {
    summary: 'CAPA: Set coating weight gain stop limit and flowmeter checks on Coater C3',
    description:
      'Trigger: dissolution failures on Ibuprofen 200 mg coated on Coater C3 (excess weight gain; spray rate drift).\n' +
      'Actions:\n' +
      '1. Add upper stop limit of 3.5% weight gain to SOP-045.\n' +
      '2. Add suspension flowmeter verification before each campaign.\n' +
      'Effectiveness check: all Coater C3 Ibuprofen batches pass dissolution at stage 1 for 3 months. Passed (7 of 7 batches).',
    equipment: 'Coater C3', product: 'Ibuprofen 200 mg tablets', failureMode: 'Dissolution failure',
    rootCause: 'Procedure gap', sopRef: 'SOP-045', owner: AMARA, resolver: AMARA,
    links: ['D08', 'D26'],
  }),
  capa('C07', 355, 300, {
    summary: 'CAPA: Increase Filler F1 fill pump calibration frequency',
    description:
      'Trigger: low fill volume on two Filler F1 stations (Sterile saline 10 mL, batch B2055) from pump calibration drift.\n' +
      'Actions:\n' +
      '1. Move fill pump calibration from quarterly to monthly.\n' +
      '2. Add per-needle fill weight trend chart to the batch review.\n' +
      'Effectiveness check: no fill volume deviations on Filler F1 for 6 months. Passed.',
    equipment: 'Filler F1', product: 'Sterile saline 10 mL vials', failureMode: 'Fill volume deviation',
    rootCause: 'Calibration drift', sopRef: 'SOP-034', owner: AMARA, resolver: AMARA,
    links: ['D14'],
  }),
  capa('C08', 12, null, {
    summary: 'CAPA: Hardness measurement reliability on Press 2',
    description:
      'Trigger: repeat hardness out-of-spec readings on Press 2 (Metformin B2259, Ibuprofen B2287).\n' +
      'Actions (planned):\n' +
      '1. Replace pre-compression force transducer on Press 2.\n' +
      '2. Monthly verification of hardness testers HT-01 and HT-03 with reference weights.\n' +
      'Effectiveness check planned: no hardness deviations on Press 2 for 3 months after closure.',
    equipment: 'Press 2', product: null, failureMode: 'Hardness out of spec',
    rootCause: 'Calibration drift', sopRef: 'SOP-012', owner: RAVI, resolver: null,
    links: ['D32', 'D38'],
  }),
];

// The deviation the presenter creates live. Free text only, no labels or fields.
export const DEMO_NEW_DEVIATION = {
  summary: 'Tablet weight out of spec on Press 4 during compression, batch B2291',
  description:
    'At 10:20 the 15-minute in-process weight check on press 4 failed: average tablet weight 1,037 mg against 1,000 mg target, ' +
    '3 of 20 tablets above the action limit. Compression stopped and tablets made since the last good check (approx. 31,000) segregated. ' +
    'Batch B2291 placed on hold pending investigation. Maintenance asked to inspect the punches.',
};

// ---------------------------------------------------------------------------
// Self-check. Run:
//   node -e "import('./src/demo/seed-data.js').then(m => console.log(m.validateSeed()))"

export const VOCAB = {
  equipment: ['Press 2', 'Press 4', 'Coater C3', 'Filler F1', 'Blister B1', 'Line 2 sealer', 'Granulator G1', 'Autoclave A2', 'Packaging Line 3', 'Mixer M2'],
  product: ['Metformin 500 mg tablets', 'Ibuprofen 200 mg tablets', 'Amoxicillin 250 mg capsules', 'Sterile saline 10 mL vials', 'Insulin pen cartridges'],
  failureMode: ['Weight variation', 'Seal integrity failure', 'Particulate contamination', 'Out-of-spec assay', 'Temperature excursion', 'Label mix-up', 'Hardness out of spec', 'Dissolution failure', 'Fill volume deviation', 'Documentation error', 'Environmental monitoring excursion', 'Capping defect'],
  rootCause: ['Tooling wear', 'Operator error', 'Supplier material', 'Calibration drift', 'Procedure gap', 'Equipment malfunction', 'Environmental control', 'Training gap'],
};

export function validateSeed() {
  const problems = [];
  const people = new Set(PEOPLE.map((p) => p.name));
  const sopRefs = new Set(SOPS.map((s) => s.sopRef));
  const all = [...SOPS, ...DEVIATIONS, ...CAPAS];

  const seen = new Set();
  for (const r of all) {
    if (seen.has(r.localId)) problems.push(`duplicate localId ${r.localId}`);
    seen.add(r.localId);
    if (!Number.isInteger(r.daysAgo) || r.daysAgo < 0 || r.daysAgo > 540) problems.push(`${r.localId}: bad daysAgo ${r.daysAgo}`);
    if (!r.summary || !r.description) problems.push(`${r.localId}: missing summary/description`);
  }

  const devById = new Map(DEVIATIONS.map((d) => [d.localId, d]));
  for (const r of [...DEVIATIONS, ...CAPAS]) {
    for (const field of ['equipment', 'product', 'failureMode', 'rootCause']) {
      if (r[field] != null && !VOCAB[field].includes(r[field])) problems.push(`${r.localId}: ${field} "${r[field]}" not canonical`);
    }
    if (r.failureMode == null) problems.push(`${r.localId}: failureMode missing`);
    if (r.sopRef != null && !sopRefs.has(r.sopRef)) problems.push(`${r.localId}: unknown sopRef ${r.sopRef}`);
    if (!people.has(r.ownerName)) problems.push(`${r.localId}: unknown owner ${r.ownerName}`);
    if (r.closedDaysAgo != null) {
      if (!Number.isInteger(r.closedDaysAgo) || r.closedDaysAgo >= r.daysAgo || r.closedDaysAgo < 0) problems.push(`${r.localId}: closedDaysAgo ${r.closedDaysAgo} not < daysAgo ${r.daysAgo}`);
      if (!people.has(r.resolverName)) problems.push(`${r.localId}: closed but resolver "${r.resolverName}" unknown`);
    } else if (r.resolverName != null) {
      problems.push(`${r.localId}: open but has resolver`);
    }
    for (const c of r.comments ?? []) if (!people.has(c.author)) problems.push(`${r.localId}: unknown comment author ${c.author}`);
  }

  for (const c of CAPAS) {
    if (!Array.isArray(c.linkedDeviations) || c.linkedDeviations.length === 0) problems.push(`${c.localId}: no linked deviations`);
    for (const id of c.linkedDeviations ?? []) {
      const d = devById.get(id);
      if (!d) problems.push(`${c.localId}: linked deviation ${id} missing`);
      // A deviation may be added to a CAPA while it is open, but not after it closed.
      else if (c.closedDaysAgo != null && d.daysAgo <= c.closedDaysAgo) problems.push(`${c.localId}: linked ${id} happened after the CAPA closed`);
    }
  }

  // Story 1: Press 4 weight variation.
  const c1 = CAPAS.find((c) => c.localId === 'C01');
  const p4w = DEVIATIONS.filter((d) => d.equipment === 'Press 4' && d.failureMode === 'Weight variation');
  const ids = p4w.map((d) => d.localId).join(',');
  if (ids !== 'D16,D18,D29,D35') problems.push(`story 1: unexpected Press 4 weight events ${ids}`);
  if (!c1 || c1.closedDaysAgo == null || c1.closedDaysAgo < 180) problems.push('story 1: C01 must be closed > 6 months ago');
  const after = p4w.filter((d) => c1 && d.daysAgo < c1.closedDaysAgo);
  if (after.length !== 2) problems.push(`story 1: expected 2 recurrences after C01 closed, got ${after.length}`);
  for (const d of after) if (!(c1.closedDaysAgo > d.daysAgo)) problems.push(`story 1: ${d.localId} not after C01 closure`);

  // Story 2: no seal integrity recurrence on Line 2 sealer after C02.
  const c2 = CAPAS.find((c) => c.localId === 'C02');
  const late = DEVIATIONS.filter((d) => d.equipment === 'Line 2 sealer' && d.failureMode === 'Seal integrity failure' && d.daysAgo < c2.closedDaysAgo);
  if (late.length) problems.push(`story 2: recurrence after C02 ${late.map((d) => d.localId)}`);

  // Story 3: C03 open.
  if (CAPAS.find((c) => c.localId === 'C03').closedDaysAgo != null) problems.push('story 3: C03 must be open');

  // Story 4: exactly one Autoclave A2 excursion after C04.
  const c4 = CAPAS.find((c) => c.localId === 'C04');
  const a2 = DEVIATIONS.filter((d) => d.equipment === 'Autoclave A2' && d.failureMode === 'Temperature excursion' && d.daysAgo < c4.closedDaysAgo);
  if (a2.length !== 1) problems.push(`story 4: expected 1 recurrence after C04, got ${a2.length}`);

  return problems;
}
