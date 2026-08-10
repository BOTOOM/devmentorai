import fs from 'node:fs';
import { type AcpProbeReport, renderSupportTable } from '../apps/backend/src/acp/probe.js';

const reportPath = process.argv[2] ?? 'docs/acp-probe-results.json';
const documentPath = 'docs/ACP.md';
const reports = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as AcpProbeReport[];
const current = fs.readFileSync(documentPath, 'utf8');
const marker =
  /<!-- GENERATED ACP SUPPORT TABLE: do not edit manually -->[\s\S]*?<!-- END GENERATED ACP SUPPORT TABLE -->/;
if (!marker.test(current)) throw new Error('Support table markers are missing from docs/ACP.md');
fs.writeFileSync(documentPath, current.replace(marker, renderSupportTable(reports)));
