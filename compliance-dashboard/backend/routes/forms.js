const express = require('express');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { requireAuth } = require('../middleware/auth');
const { generateFilledPages } = require('../services/isr1PdfGenerator');

const router = express.Router();

const REFERENCE_PDF_PATH = path.join(__dirname, '..', 'assets', 'forms', 'ISR_1_reference.pdf');

function normalizeIsr1Payload(body) {
  // Accepts the raw JSON posted by the frontend form and fills in safe
  // defaults, so a partially-filled form never crashes PDF generation.
  const holders = (body.holders || []).filter((h) => h && h.name).slice(0, 3);
  const declarations = (body.declarations || holders).slice(0, 3);

  return {
    date: body.date || { d: '', m: '', y: '' },
    checksA: body.checksA || {},
    issuerCompany: body.issuerCompany || '',
    folioNo: body.folioNo || '',
    holders: holders.length ? holders : [{ name: '', pan: '' }],
    numFaceValue: body.numFaceValue || '',
    distinctiveFrom: body.distinctiveFrom || '',
    distinctiveTo: body.distinctiveTo || '',
    panAadhaarLinked: body.panAadhaarLinked || 'Yes',
    dematAccount: body.dematAccount || '',
    addressProof: body.addressProof || '',
    bankAccount: body.bankAccount || '',
    bankName: body.bankName || '',
    branchName: body.branchName || '',
    ifsc: body.ifsc || '',
    email: body.email || '',
    mobile: body.mobile || '',
    declarations,
    additionalFolios: (body.additionalFolios || []).filter((f) => f && f.company),
  };
}

// POST /api/forms/isr1/generate
// Body: ISR-1 form data (see isr1PdfGenerator.js header comment for shape).
// Returns: application/pdf — the complete 7-page filled ISR-1 form.
router.post('/isr1/generate', requireAuth, async (req, res) => {
  try {
    if (!fs.existsSync(REFERENCE_PDF_PATH)) {
      return res.status(500).json({
        error: 'Reference ISR-1 PDF is missing from the server (expected at backend/assets/forms/ISR_1_reference.pdf).',
      });
    }

    const data = normalizeIsr1Payload(req.body || {});

    // 1. Generate the 3 filled pages (Sections A/B/C, Authorization, Declaration).
    const filledBytes = await generateFilledPages(data);

    // 2. Load both PDFs and assemble: filled pages 1-3 + original reference
    //    pages 4-7 (the static instructions/notes, unchanged).
    const filledDoc = await PDFDocument.load(filledBytes);
    const referenceBytes = fs.readFileSync(REFERENCE_PDF_PATH);
    const referenceDoc = await PDFDocument.load(referenceBytes);

    const outputDoc = await PDFDocument.create();

    const filledPages = await outputDoc.copyPages(filledDoc, filledDoc.getPageIndices());
    filledPages.forEach((p) => outputDoc.addPage(p));

    const referencePageIndices = referenceDoc.getPageIndices().slice(3); // pages 4-7 (0-indexed 3-6)
    const referencePages = await outputDoc.copyPages(referenceDoc, referencePageIndices);
    referencePages.forEach((p) => outputDoc.addPage(p));

    const finalBytes = await outputDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="ISR-1-filled.pdf"');
    res.send(Buffer.from(finalBytes));
  } catch (err) {
    console.error('ISR-1 generation failed:', err);
    res.status(500).json({ error: 'Could not generate the filled form: ' + err.message });
  }
});

module.exports = router;