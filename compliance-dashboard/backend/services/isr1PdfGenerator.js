const PDFDocument = require('pdfkit');

// ---------------------------------------------------------------------------
// This mirrors the reportlab prototype pixel-for-pixel, but pdfkit's y-axis
// increases DOWNWARD from the top of the page (reportlab's increases upward
// from the bottom). To keep all the layout math below identical in spirit to
// the prototype (y starts near the top and DECREASES as content flows down
// the page), every drawing call goes through toY(), which flips the axis:
//   toY(y) = PAGE_H - y
// ---------------------------------------------------------------------------

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const R = PAGE_W - 40;

function toY(y) {
  return PAGE_H - y;
}

function hline(doc, x1, x2, y, w = 0.7) {
  doc.lineWidth(w).moveTo(x1, toY(y)).lineTo(x2, toY(y)).stroke('black');
}

function vline(doc, x, y1, y2, w = 0.7) {
  doc.lineWidth(w).moveTo(x, toY(y1)).lineTo(x, toY(y2)).stroke('black');
}

function txt(doc, x, y, s, opts = {}) {
  const { size = 8, font = 'Helvetica', color = 'black', align = 'left' } = opts;
  doc.font(font).fontSize(size).fillColor(color);
  const w = doc.widthOfString(s);
  let drawX = x;
  if (align === 'center') drawX = x - w / 2;
  if (align === 'right') drawX = x - w;
  // pdfkit's text() positions y at the TOP of the line box, whereas the
  // layout math throughout this file assumes reportlab's convention (y is
  // the text BASELINE). Convert using the font's real ascender metric
  // rather than a guessed constant, so text lines up precisely with
  // graphics (checkboxes, box grids, lines) drawn at the same y.
  const ascent = (doc._font.ascender / 1000) * size;
  doc.text(s, drawX, toY(y) - ascent, { lineBreak: false });
}

// Draws a checkmark (\u2713) as vector strokes rather than relying on the
// glyph, since Helvetica's standard WinAnsi encoding in pdfkit does not
// include a checkmark character and renders it as a garbled fallback glyph.
function drawTick(doc, x, y, size = 8) {
  doc.lineWidth(1.1);
  doc.moveTo(x, toY(y + size * 0.38)).lineTo(x + size * 0.38, toY(y)).stroke('black');
  doc.moveTo(x + size * 0.38, toY(y)).lineTo(x + size, toY(y + size * 0.8)).stroke('black');
}

// Wraps text to fit maxWidth (measuring real glyph widths), returns the list
// of lines actually drawn, and the y position after the block.
function wrapped(doc, x, y, s, opts = {}) {
  const { size = 7.8, font = 'Helvetica', maxWidth = 400, leading = 10, color = 'black' } = opts;
  doc.font(font).fontSize(size);
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = (cur + ' ' + w).trim();
    if (doc.widthOfString(trial) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);

  let yy = y;
  for (const ln of lines) {
    txt(doc, x, yy, ln, { size, font, color });
    yy -= leading;
  }
  return yy;
}

function checkbox(doc, x, y, checked, size = 9) {
  doc.lineWidth(0.8).rect(x, toY(y) - size, size, size).stroke('black');
  if (checked) {
    doc.lineWidth(1.1);
    doc.moveTo(x + 1.3, toY(y) - size + 1.3).lineTo(x + size - 1.3, toY(y) - 1.3).stroke('black');
    doc.moveTo(x + 1.3, toY(y) - 1.3).lineTo(x + size - 1.3, toY(y) - size + 1.3).stroke('black');
  }
}

// Draws n boxes; fills each with one character of value if present. Returns
// the x position right after the last box.
function charBoxes(doc, x, y, value, { n = 10, box = 12.5, gap = 1.6, size = 9 } = {}) {
  const v = (value || '').slice(0, n);
  for (let i = 0; i < n; i++) {
    const bx = x + i * (box + gap);
    doc.lineWidth(0.7).rect(bx, toY(y) - box, box, box).stroke('black');
    if (i < v.length) {
      txt(doc, bx + box / 2, y + box / 2 - size * 0.3, v[i], { size, font: 'Helvetica-Bold', align: 'center' });
    }
  }
  return x + n * (box + gap);
}

// Draws a full-bordered grid. cellFn(rowIdx, colIdx, cx, cyTop, cw, rh) draws
// cell contents; cyTop is the row's TOP y (same convention as the prototype).
// Returns the bottom y of the table.
function gridTable(doc, x, topY, colWidths, rowHeights, cellFn) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const rowTops = [topY];
  let y = topY;
  for (const rh of rowHeights) {
    y -= rh;
    rowTops.push(y);
  }
  const bottomY = rowTops[rowTops.length - 1];

  for (const ry of rowTops) hline(doc, x, x + totalW, ry);

  const colLefts = [x];
  let cx = x;
  for (const cw of colWidths) {
    cx += cw;
    colLefts.push(cx);
  }
  for (const clx of colLefts) vline(doc, clx, bottomY, topY);

  rowHeights.forEach((rh, r) => {
    const cyTop = rowTops[r];
    let cxx = x;
    colWidths.forEach((cw, col) => {
      cellFn(r, col, cxx, cyTop, cw, rh);
      cxx += cw;
    });
  });

  return bottomY;
}

/**
 * Generates the 3 filled ISR-1 pages (Section A/B/C, Authorization,
 * Declaration) as a Buffer, given a `data` object shaped like:
 *
 * {
 *   date: { d, m, y },
 *   checksA: { PAN, "Bank details", Signature, "Mobile number", "E-mail ID", Address },
 *   issuerCompany, folioNo,
 *   holders: [ { name, pan }, ... ]        // 1-3 entries
 *   numFaceValue, distinctiveFrom, distinctiveTo,
 *   panAadhaarLinked: "Yes" | "No",
 *   dematAccount,
 *   addressProof: "UID" | "PASSPORT" | "MAINT" | "UTILITY" | "IDCARD" | "FII" | "SPOUSE" | "CML",
 *   bankAccount, bankName, branchName, ifsc,
 *   email, mobile,
 *   declarations: [ { name, address, pin }, ... ]   // matches holders, 1-3 entries
 *   additionalFolios: [ { company, folioNo, qty, faceValue, distinctiveNo }, ... ]
 * }
 */
function generateFilledPages(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const ADDRESS_OPTIONS = [
      ['UID', 'Unique Identification Number (UID) (Aadhaar)'],
      ['PASSPORT', 'Valid Passport/ Registered Lease or Sale Agreement of Residence / Driving License'],
      ['MAINT', 'Flat Maintenance bill accompanied with additional self-attested copy of Identity Proof of the holder/claimant.'],
      ['UTILITY', 'Utility bills like Telephone Bill (only land line)/ Electricity bill / Gas bill - Not more than 3 months old.'],
      ['IDCARD', 'Identity card / document with address, issued by Central/State Govt., Statutory/Regulatory Authorities, PSUs, Scheduled Banks, or Public Financial Institutions.'],
      ['FII', 'For FII / sub account, Power of Attorney given to the Custodians (notarized / apostilled) showing the registered address.'],
      ['SPOUSE', 'Proof of address in the name of the spouse with self-attested Identity Proof of the spouse.'],
      ['CML', 'Client Master List (CML) of the Demat Account of the holder / claimant.'],
    ];

    // ================= PAGE 1 =================
    let y = PAGE_H - 38;
    txt(doc, PAGE_W / 2, y, 'Form ISR \u2013 1', { size: 13, font: 'Helvetica-Bold', align: 'center' });
    y -= 15;
    txt(doc, PAGE_W / 2, y, '(see SEBI Circular No. SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2023/37 dated March 16, 2023 on', { size: 7.6, font: 'Helvetica-Oblique', align: 'center' });
    y -= 10;
    txt(doc, PAGE_W / 2, y, "Common and Simplified Norms for processing investor's service request by RTAs and norms for", { size: 7.6, font: 'Helvetica-Oblique', align: 'center' });
    y -= 10;
    txt(doc, PAGE_W / 2, y, 'furnishing PAN, KYC details and Nomination)', { size: 7.6, font: 'Helvetica-Oblique', align: 'center' });
    y -= 17;
    txt(doc, PAGE_W / 2, y, 'REQUEST FOR REGISTERING PAN, KYC DETAILS OR CHANGES / UPDATION THEREOF', { size: 9.5, font: 'Helvetica-Bold', align: 'center' });
    y -= 12;
    txt(doc, PAGE_W / 2, y, '[For Securities (Shares / Debentures / Bonds, etc.) of listed companies held in physical form]', { size: 8, font: 'Helvetica-Oblique', align: 'center' });
    y -= 20;

    txt(doc, R - 200, y, 'Date:', { size: 9, font: 'Helvetica-Bold' });
    txt(doc, R - 163, y, data.date.d, { size: 9, font: 'Helvetica-Bold', align: 'center' });
    hline(doc, R - 178, R - 148, y - 2);
    txt(doc, R - 120, y, data.date.m, { size: 9, font: 'Helvetica-Bold', align: 'center' });
    hline(doc, R - 135, R - 105, y - 2);
    txt(doc, R - 72, y, data.date.y, { size: 9, font: 'Helvetica-Bold', align: 'center' });
    hline(doc, R - 97, R - 47, y - 2);
    txt(doc, R - 148, y, '/', { size: 9.5, font: 'Helvetica-Bold', align: 'center' });
    txt(doc, R - 105, y, '/', { size: 9.5, font: 'Helvetica-Bold', align: 'center' });
    y -= 26;

    txt(doc, M, y, 'A.', { size: 9, font: 'Helvetica-Bold' });
    txt(doc, M + 20, y, 'I / We request you to Register / Change / Update the following (Tick', { size: 8.7 });
    {
      const tickX = M + 20 + doc.font('Helvetica').fontSize(8.7).widthOfString('I / We request you to Register / Change / Update the following (Tick ');
      drawTick(doc, tickX, y - 1, 7);
      txt(doc, tickX + 11, y, 'relevant box)', { size: 8.7 });
    }
    y -= 12;

    const colW = (R - M) / 3;
    const rowH = 32;
    const secALabels = [
      ['PAN', 'Bank details', 'Signature'],
      ['Mobile number', 'E-mail ID', 'Address'],
    ];
    y = gridTable(doc, M, y, [colW, colW, colW], [rowH, rowH], (r, col, cx, cy, cw, ch) => {
      const lab = secALabels[r][col];
      checkbox(doc, cx + 8, cy - ch + ch / 2 + 4.5, !!data.checksA[lab]);
      txt(doc, cx + 24, cy - ch + ch / 2 - 2, lab, { size: 8.7 });
    });
    y -= 20;

    txt(doc, M, y, 'B.', { size: 9, font: 'Helvetica-Bold' });
    txt(doc, M + 20, y, 'Security Details:', { size: 9, font: 'Helvetica-Bold' });
    y -= 12;

    const labelW = 190;
    const valueW = (R - M) - labelW;
    const folioColW = 150;

    const secBRowHeights = [28, 48, 28, 28];
    const secBTop = y;
    y = gridTable(doc, M, y, [labelW, valueW], secBRowHeights, (r, col, cx, cy, cw, ch) => {
      const pad = 5;
      if (r === 0) {
        if (col === 0) {
          txt(doc, cx + pad, cy - 13, 'Name of the Issuer Company', { size: 8.3 });
        } else {
          txt(doc, cx + pad, cy - 13, data.issuerCompany, { size: 8.6, font: 'Helvetica-Bold' });
          const fx = cx + cw - folioColW;
          txt(doc, fx + pad, cy - 13, 'Folio No.:', { size: 8 });
          txt(doc, fx + 62, cy - 13, data.folioNo, { size: 8.6, font: 'Helvetica-Bold' });
        }
      } else if (r === 1) {
        if (col === 0) {
          wrapped(doc, cx + pad, cy - 12, 'Name(s) of the Security holder(s) as per the Certificate(s)', { size: 8, maxWidth: cw - 10, leading: 10 });
        } else {
          let yy = cy - 12;
          data.holders.forEach((h, i) => {
            txt(doc, cx + pad, yy, `${i + 1}. ${h.name || ''}`, { size: 8.4, font: h.name ? 'Helvetica-Bold' : 'Helvetica' });
            yy -= 13;
          });
        }
      } else if (r === 2) {
        if (col === 0) {
          wrapped(doc, cx + pad, cy - 13, 'Number & Face value of securities', { size: 8.3, maxWidth: cw - 10, leading: 10 });
        } else {
          txt(doc, cx + pad, cy - 13, data.numFaceValue, { size: 8.6, font: 'Helvetica-Bold' });
        }
      } else if (r === 3) {
        if (col === 0) {
          wrapped(doc, cx + pad, cy - 13, 'Distinctive number of securities (Optional)', { size: 8.3, maxWidth: cw - 10, leading: 10 });
        } else {
          let fx = cx + pad;
          txt(doc, fx, cy - 13, 'From', { size: 8 });
          fx += doc.font('Helvetica').fontSize(8).widthOfString('From ') + 4;
          txt(doc, fx, cy - 13, data.distinctiveFrom, { size: 8.6, font: 'Helvetica-Bold' });
          fx += doc.font('Helvetica-Bold').fontSize(8.6).widthOfString(data.distinctiveFrom) + 24;
          txt(doc, fx, cy - 13, 'To', { size: 8 });
          fx += doc.font('Helvetica').fontSize(8).widthOfString('To ') + 4;
          txt(doc, fx, cy - 13, data.distinctiveTo, { size: 8.6, font: 'Helvetica-Bold' });
        }
      }
    });
    vline(doc, R - folioColW, secBTop - secBRowHeights[0], secBTop);
    y -= 20;

    txt(doc, M, y, 'C.', { size: 9, font: 'Helvetica-Bold' });
    txt(doc, M + 20, y, 'I / We are submitting documents as per Table below (tick', { size: 8.7, font: 'Helvetica-Bold' });
    {
      const tickX = M + 20 + doc.font('Helvetica-Bold').fontSize(8.7).widthOfString('I / We are submitting documents as per Table below (tick ');
      drawTick(doc, tickX, y - 1, 7);
      txt(doc, tickX + 11, y, 'as relevant, refer to the', { size: 8.7, font: 'Helvetica-Bold' });
    }
    y -= 10;
    txt(doc, M + 20, y, 'instructions):', { size: 8.7, font: 'Helvetica-Bold' });
    y -= 24;

    const c1 = 16, c2 = 16, c3 = 118;
    const c4 = (R - M) - c1 - c2 - c3;

    y = gridTable(doc, M, y, [c1, c2, c3, c4], [32], (r, col, cx, cy, cw, ch) => {
      if (col === 1) drawTick(doc, cx + cw / 2 - 4, cy - ch / 2 - 4, 8);
      else if (col === 2) {
        ['Document /', 'Information', '/ Details'].forEach((ln, i) => {
          txt(doc, cx + cw / 2, cy - 11 - i * 9, ln, { size: 7.6, font: 'Helvetica-Bold', align: 'center' });
        });
      } else if (col === 3) txt(doc, cx + cw / 2, cy - ch / 2 - 3, 'Instruction / Remark', { size: 8, font: 'Helvetica-Bold', align: 'center' });
    });

    const row1Heights = [18, 150];
    const sec1Top = y;
    y = gridTable(doc, M, y, [c1, c2, c3, c4], row1Heights, (r, col, cx, cy, cw, ch) => {
      if (r === 0) {
        if (col === 0) txt(doc, cx + 4, cy - 13, '1', { size: 8 });
      } else if (r === 1) {
        if (col === 2) {
          wrapped(doc, cx + 3, cy - 11, 'PAN', { size: 8, maxWidth: cw - 6, leading: 10 });
          wrapped(doc, cx + 3, cy - 24, 'Whether it is Valid (linked to Aadhaar):', { size: 7.3, maxWidth: cw - 6, leading: 8.5 });
          const yesY = cy - 58;
          checkbox(doc, cx + 3, yesY + 7, data.panAadhaarLinked === 'Yes', 7);
          txt(doc, cx + 13, yesY + 1, 'Yes', { size: 7.3 });
          checkbox(doc, cx + 40, yesY + 7, data.panAadhaarLinked === 'No', 7);
          txt(doc, cx + 50, yesY + 1, 'No', { size: 7.3 });
        }
        if (col === 3) {
          let by = cy - 16;
          for (let i = 0; i < 3; i++) {
            const val = data.holders[i]?.pan || '';
            const endX = charBoxes(doc, cx + 4, by, val, { n: 10, box: 11.5, gap: 1.4 });
            txt(doc, endX + 4, by - 6, ',', { size: 9 });
            by -= 20;
          }
          let yy = by - 4;
          yy = wrapped(doc, cx + 4, yy, 'PAN shall be valid only if it is linked to Aadhaar by March 31, 2023*', { size: 7, maxWidth: cw - 8, leading: 9 });
          wrapped(doc, cx + 4, yy, 'For Exemptions/Clarifications on PAN, please refer to Objection Memo in Page 6 & 7', { size: 7, maxWidth: cw - 8, leading: 9 });
        }
      }
    });
    // Erase internal dividers for row 0 (checkbox/doc/instruction columns)
    // so the "PAN of (all) the (joint) holder(s)" heading reads as one
    // merged cell, matching the original form (Sno column stays separate).
    doc.lineWidth(1.4);
    doc.moveTo(M + c1 + c2, toY(sec1Top) - 0.5).lineTo(M + c1 + c2, toY(sec1Top - row1Heights[0]) + 0.5).stroke('white');
    doc.moveTo(M + c1 + c2 + c3, toY(sec1Top) - 0.5).lineTo(M + c1 + c2 + c3, toY(sec1Top - row1Heights[0]) + 0.5).stroke('white');
    txt(doc, M + c1 + 6, sec1Top - 13, 'PAN of (all) the (joint) holder(s)', { size: 8.3, font: 'Helvetica-Bold' });

    y = gridTable(doc, M, y, [c1, c2, c3, c4], [58], (r, col, cx, cy, cw, ch) => {
      if (col === 2) {
        txt(doc, cx + 3, cy - 13, '2', { size: 8 });
        wrapped(doc, cx + c1 + 3, cy - 13, 'Demat Account Number (Optional)', { size: 7.8, maxWidth: cw - c1 - 6, leading: 9 });
      }
      if (col === 3) {
        const endX = charBoxes(doc, cx + 4, cy - 17, data.dematAccount, { n: 8, box: 11.5, gap: 1.4 });
        charBoxes(doc, endX + 10, cy - 17, (data.dematAccount || '').slice(8), { n: 8, box: 11.5, gap: 1.4 });
        wrapped(doc, cx + 4, cy - 34, 'Also provide Client Master List (CML) of your Demat Account, provided by the Depository Participant.', { size: 7, maxWidth: cw - 8, leading: 9 });
      }
    });

    txt(doc, M, 24, 'Page 1 of 7', { size: 7, font: 'Helvetica-Oblique', color: 'grey' });
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });

    // ================= PAGE 2 =================
    y = PAGE_H - 40;

    y = gridTable(doc, M, y, [c1, c2, c3, c4], [244], (r, col, cx, cy, cw, ch) => {
      if (col === 2) {
        txt(doc, cx + 3, cy - 13, '3', { size: 8 });
        wrapped(doc, cx + c1 + 3, cy - 13, 'Proof of Address of the first holder', { size: 7.8, maxWidth: cw - c1 - 6, leading: 9 });
      }
      if (col === 3) {
        let yy = cy - 13;
        txt(doc, cx + 4, yy, 'Any one of the documents, only if there is change in the address;', { size: 7.6 });
        yy -= 16;
        for (const [key, label] of ADDRESS_OPTIONS) {
          checkbox(doc, cx + 4, yy - 2, data.addressProof === key, 8);
          yy = wrapped(doc, cx + 18, yy, label, { size: 7.4, maxWidth: cw - 22, leading: 9 });
          yy -= 4;
        }
      }
    });

    y = gridTable(doc, M, y, [c1, c2, c3, c4], [118], (r, col, cx, cy, cw, ch) => {
      if (col === 2) {
        txt(doc, cx + 3, cy - 13, '4', { size: 8 });
        wrapped(doc, cx + c1 + 3, cy - 13, 'Bank details (to be updated for first holder in case of joint holding)', { size: 7.4, maxWidth: cw - c1 - 6, leading: 8.7 });
      }
      if (col === 3) {
        let yy = cy - 13;
        const field = (label, value) => {
          txt(doc, cx + 4, yy, `${label}:`, { size: 7.8 });
          const lx = cx + 4 + 78;
          txt(doc, lx, yy, value, { size: 8.4, font: 'Helvetica-Bold' });
          hline(doc, lx - 3, cx + cw - 40, yy - 2, 0.5);
          yy -= 13;
        };
        field('Account Number', data.bankAccount);
        field('Bank Name', data.bankName);
        field('Branch Name', data.branchName);
        field('IFS Code', data.ifsc);
        yy -= 3;
        txt(doc, cx + cw / 2, yy, 'Provide the following:', { size: 7.6, align: 'center' });
        yy -= 14;
        checkbox(doc, cx + 4, yy - 2, true, 8);
        yy = wrapped(doc, cx + 18, yy, 'Original cancelled cheque bearing the name of the security holder; OR', { size: 7.4, maxWidth: cw - 22, leading: 9 });
        yy -= 4;
        checkbox(doc, cx + 4, yy - 2, false, 8);
        wrapped(doc, cx + 18, yy, 'Bank passbook/statement attested by the Bank;', { size: 7.4, maxWidth: cw - 22, leading: 9 });
      }
    });

    y = gridTable(doc, M, y, [c1, c2, c3, c4], [22, 22], (r, col, cx, cy, cw, ch) => {
      if (r === 0) {
        if (col === 2) {
          txt(doc, cx + 3, cy - 15, '5', { size: 8 });
          txt(doc, cx + c1 + 3, cy - 15, 'E-mail address', { size: 8 });
        }
        if (col === 3) {
          txt(doc, cx + 4, cy - 15, data.email, { size: 8.6, font: 'Helvetica-Bold' });
          hline(doc, cx + 4, cx + cw - 30, cy - 17, 0.5);
        }
      }
      if (r === 1) {
        if (col === 2) {
          txt(doc, cx + 3, cy - 15, '6', { size: 8 });
          txt(doc, cx + c1 + 3, cy - 15, 'Mobile', { size: 8 });
        }
        if (col === 3) {
          txt(doc, cx + 4, cy - 15, data.mobile, { size: 8.6, font: 'Helvetica-Bold' });
          hline(doc, cx + 4, cx + cw - 30, cy - 17, 0.5);
        }
      }
    });
    y -= 12;
    y = wrapped(doc, M, y, '* or any date as may be specified by the CBDT      (DP: Depository Participant)', { size: 7.4, font: 'Helvetica-Oblique', maxWidth: R - M, leading: 9 });
    y -= 2;
    wrapped(doc, M, y, '# In case it is not provided, the details available in the CML will be updated in the folio', { size: 7.4, font: 'Helvetica-Oblique', maxWidth: R - M, leading: 9 });

    txt(doc, M, 24, 'Page 2 of 7', { size: 7, font: 'Helvetica-Oblique', color: 'grey' });
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });

    // ================= PAGE 3 =================
    y = PAGE_H - 40;
    y = wrapped(doc, M, y, 'Authorization: I/ We authorise you (RTA) to update the above PAN and KYC details in following additional folio(s) held in my / our name (use Separate Annexure if extra space is required):', { size: 8.3, font: 'Helvetica-Bold', maxWidth: R - M, leading: 11 });
    y -= 20;

    const authCols = [28, 128, 78, 78, 82];
    authCols.push((R - M) - authCols.reduce((a, b) => a + b, 0));

    const authHeaders = ['S. No.', 'Name of the Issuer Company', 'Folio No.', 'Quantity of securities', 'Face value of securities', 'Distinctive number of securities (Optional)'];
    const folios = data.additionalFolios || [];
    const numFolioRows = Math.max(3, folios.length);
    const authRowHeights = [26, ...Array(numFolioRows).fill(18)];

    y = gridTable(doc, M, y, authCols, authRowHeights, (r, col, cx, cy, cw, ch) => {
      if (r === 0) {
        doc.font('Helvetica-Bold').fontSize(7.6);
        const words = authHeaders[col].split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
          const trial = (cur + ' ' + w).trim();
          if (doc.widthOfString(trial) <= cw - 8) cur = trial;
          else {
            if (cur) lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);
        let yy = cy - 11;
        for (const ln of lines) {
          txt(doc, cx + 4, yy, ln, { size: 7.6, font: 'Helvetica-Bold' });
          yy -= 9;
        }
        return;
      }
      const idx = r - 1;
      if (idx >= folios.length) return;
      const f = folios[idx];
      const values = [String(idx + 1), f.company, f.folioNo, f.qty, f.faceValue, f.distinctiveNo];
      txt(doc, cx + 4, cy - ch / 2 - 3, values[col] || '', { size: 7.8, font: col > 0 ? 'Helvetica-Bold' : 'Helvetica' });
    });

    y -= 12;
    y = wrapped(doc, M, y, 'in which I / We are the holder(s) (strike off what is not applicable).', { size: 8, maxWidth: R - M, leading: 10 });
    y -= 14;

    txt(doc, M, y, 'Declaration:', { size: 8.7, font: 'Helvetica-Bold' });
    txt(doc, M + 62, y, 'All the above facts stated are true and correct.', { size: 8.7 });
    y -= 12;

    const declCol0 = 90;
    const declColW = (R - M - declCol0) / 3;
    const declarations = data.declarations || [];

    gridTable(doc, M, y, [declCol0, declColW, declColW, declColW], [18, 34, 22, 40, 26], (r, col, cx, cy, cw, ch) => {
      const rowLabels = ['', 'Signature', 'Name', 'Full address', 'PIN'];
      if (r === 0) {
        if (col === 0) return;
        txt(doc, cx + cw / 2, cy - ch / 2 - 3, ['Holder 1', 'Holder 2', 'Holder 3'][col - 1], { size: 8.6, font: 'Helvetica-Bold', align: 'center' });
        return;
      }
      if (col === 0) {
        txt(doc, cx + 4, cy - ch / 2 - 3, rowLabels[r], { size: 8.3, font: 'Helvetica-Bold' });
        return;
      }
      const holder = declarations[col - 1];
      if (!holder || !holder.name) return;
      if (r === 1) txt(doc, cx + cw / 2, cy - ch / 2 - 3, '(e-signed)', { size: 8, font: 'Helvetica-Oblique', align: 'center' });
      if (r === 2) txt(doc, cx + cw / 2, cy - ch / 2 - 3, holder.name, { size: 8.4, align: 'center' });
      if (r === 3) {
        doc.font('Helvetica').fontSize(7.4);
        const words = (holder.address || '').split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
          const trial = (cur + ' ' + w).trim();
          if (doc.widthOfString(trial) <= cw - 10) cur = trial;
          else {
            if (cur) lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);
        let ay = cy - ch / 2 + (lines.length - 1) * 4.5;
        for (const ln of lines) {
          txt(doc, cx + cw / 2, ay, ln, { size: 7.4, align: 'center' });
          ay -= 9;
        }
      }
      if (r === 4 && holder.pin) {
        charBoxes(doc, cx + cw / 2 - 42, cy - ch / 2 - 6.5, holder.pin, { n: 6, box: 13, gap: 1.6 });
      }
    });
    y -= 34 + 22 + 40 + 26 + 18 + 26;

    txt(doc, M, y, 'Mode of submission of documents to the RTA', { size: 9, font: 'Helvetica-Bold' });
    y -= 14;
    txt(doc, M, y, 'Please use any one of the following mode:', { size: 8.5 });
    y -= 16;
    txt(doc, M, y, '1.', { size: 8.5, font: 'Helvetica-Bold' });
    y = wrapped(doc, M + 16, y, "Through \u2018In Person Verification\u2019 (IPV): The authorized person of the RTA shall verify the original documents furnished by the investor and retain copy (ies) with IPV stamping with date and initials.", { size: 8.5, maxWidth: R - M - 16, leading: 12 });
    y -= 6;
    txt(doc, M, y, '2.', { size: 8.5, font: 'Helvetica-Bold' });
    wrapped(doc, M + 16, y, 'Through Post: Hard copies of the documents which are self-attested.', { size: 8.5, maxWidth: R - M - 16, leading: 12 });

    txt(doc, M, 24, 'Page 3 of 7', { size: 7, font: 'Helvetica-Oblique', color: 'grey' });

    doc.end();
  });
}

module.exports = { generateFilledPages };