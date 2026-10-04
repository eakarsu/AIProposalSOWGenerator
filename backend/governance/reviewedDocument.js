'use strict';

const crypto = require('node:crypto');
const PDFDocument = require('pdfkit');

const proposalFields = [
  ['Executive summary', 'executive_summary'], ['Scope of work', 'scope_of_work'],
  ['Deliverables', 'deliverables'], ['Timeline', 'timeline'],
  ['Pricing', 'pricing_summary'], ['Terms and conditions', 'terms_conditions'],
];
const sowFields = [
  ['Introduction', 'introduction'], ['Objectives', 'objectives'],
  ['Scope of work', 'scope'], ['Deliverables', 'deliverables'],
  ['Timeline', 'timeline'], ['Milestones', 'milestones'],
  ['Assumptions', 'assumptions'], ['Constraints', 'constraints'],
  ['Acceptance criteria', 'acceptance_criteria'], ['Payment terms', 'payment_terms'],
  ['Change management', 'change_management'], ['Governance', 'governance'],
];

function problem(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status });
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function snapshot(kind, row) {
  const fields = kind === 'proposal' ? proposalFields : sowFields;
  const source = {
    kind,
    id: Number(row.id),
    version: Number(row.version),
    status: row.status,
    title: String(row.title || ''),
    clientCompany: String(row.company_name || ''),
    totalAmount: row.total_amount == null ? null : String(row.total_amount),
    validUntil: row.valid_until ? new Date(row.valid_until).toISOString().slice(0, 10) : null,
    sections: fields.map(([heading, key]) => ({ heading, text: String(row[key] || '') })),
  };
  if (source.status !== 'approved' || !Number.isSafeInteger(source.version) || source.version < 1 || !source.title.trim()) {
    throw problem('REVIEWED_SOURCE_REQUIRED', 'The source must be a titled, approved proposal or SOW with a version.');
  }
  if (Buffer.byteLength(canonical(source), 'utf8') > 256 * 1024) {
    throw problem('SOURCE_TOO_LARGE', 'The reviewed source exceeds the local PDF limit.', 413);
  }
  return { source, digest: sha256(Buffer.from(canonical(source), 'utf8')) };
}

async function loadReviewedDocument(query, kind, id, ownerId) {
  if (!['proposal', 'sow'].includes(kind) || !Number.isSafeInteger(Number(id)) || Number(id) < 1 ||
      !Number.isSafeInteger(Number(ownerId)) || Number(ownerId) < 1) {
    throw problem('SOURCE_REFERENCE_INVALID', 'A proposal or SOW ID owned by the case creator is required.', 400);
  }
  const sql = kind === 'proposal'
    ? `SELECT p.*, c.company_name FROM proposals p LEFT JOIN clients c ON c.id=p.client_id
       WHERE p.id=$1 AND p.created_by=$2`
    : `SELECT s.*, c.company_name FROM sows s LEFT JOIN clients c ON c.id=s.client_id
       WHERE s.id=$1 AND s.created_by=$2`;
  const rows = await query(sql, [Number(id), Number(ownerId)]);
  if (!rows[0]) throw problem('REVIEWED_SOURCE_NOT_FOUND', 'Approved source not found for this case creator.', 404);
  return snapshot(kind, rows[0]);
}

function assertBinding(binding, reviewed) {
  if (!binding || binding.kind !== reviewed.source.kind || Number(binding.id) !== reviewed.source.id ||
      Number(binding.version) !== reviewed.source.version || binding.sha256 !== reviewed.digest) {
    throw problem('SOURCE_VERSION_CHANGED', 'The approved source no longer matches the frozen case source digest.');
  }
}

async function renderPdf(source) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 54, info: { Title: source.title, Author: 'Governed proposal release' } });
    const chunks = [];
    let length = 0;
    doc.on('data', chunk => {
      chunks.push(chunk);
      length += chunk.length;
      if (length > 10 * 1024 * 1024) doc.destroy(problem('PDF_TOO_LARGE', 'Rendered PDF exceeds 10 MB.', 413));
    });
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const accent = source.kind === 'proposal' ? '#1a73e8' : '#0d904f';
    doc.fillColor(accent).font('Helvetica-Bold').fontSize(22)
      .text(source.kind === 'proposal' ? 'PROPOSAL' : 'STATEMENT OF WORK');
    doc.moveDown(0.5).fillColor('#172033').fontSize(17).text(source.title);
    doc.moveDown(0.5).font('Helvetica').fontSize(10)
      .text(`Prepared for: ${source.clientCompany || 'Named client in source record'}`)
      .text(`Approved source version: ${source.version}`);
    if (source.validUntil) doc.text(`Valid until: ${source.validUntil}`);
    doc.moveDown(1);
    for (const section of source.sections) {
      if (!section.text.trim()) continue;
      doc.fillColor(accent).font('Helvetica-Bold').fontSize(12).text(section.heading, { keepWithNext: true });
      doc.fillColor('#172033').font('Helvetica').fontSize(10).text(section.text, { lineGap: 3 });
      doc.moveDown(0.8);
    }
    if (source.totalAmount !== null) {
      doc.fillColor(accent).font('Helvetica-Bold').fontSize(12).text(`Total amount: ${source.totalAmount}`);
    }
    doc.moveDown(1).fillColor('#555').font('Helvetica').fontSize(8)
      .text('This reviewed PDF is a release artifact. Any signer acceptance is recorded separately and is not an external electronic signature receipt.');
    doc.end();
  });
}

module.exports = { sha256, canonical, snapshot, loadReviewedDocument, assertBinding, renderPdf, problem };
