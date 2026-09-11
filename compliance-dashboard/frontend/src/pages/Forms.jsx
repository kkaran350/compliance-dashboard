import React, { useState } from 'react';
import { Plus, Trash2, Download, FileText } from 'lucide-react';
import api from '../api.js';

const CATEGORIES_A = ['PAN', 'Bank details', 'Signature', 'Mobile number', 'E-mail ID', 'Address'];

const ADDRESS_PROOF_OPTIONS = [
  ['UID', 'Unique Identification Number (UID) (Aadhaar)'],
  ['PASSPORT', 'Valid Passport / Registered Lease or Sale Agreement of Residence / Driving License'],
  ['MAINT', 'Flat Maintenance bill + self-attested Identity Proof'],
  ['UTILITY', 'Utility bill (Telephone landline / Electricity / Gas) — not more than 3 months old'],
  ['IDCARD', 'Identity card/document with address (Govt., Statutory Authority, PSU, Bank, PFI)'],
  ['FII', 'For FII/sub-account: notarized Power of Attorney to Custodians'],
  ['SPOUSE', "Proof of address in spouse's name + spouse's Identity Proof"],
  ['CML', 'Client Master List (CML) of the Demat Account'],
];

const emptyHolder = () => ({ name: '', pan: '', address: '', pin: '' });
const emptyFolio = () => ({ company: '', folioNo: '', qty: '', faceValue: '', distinctiveNo: '' });

const today = new Date();
const emptyForm = {
  date: {
    d: String(today.getDate()).padStart(2, '0'),
    m: String(today.getMonth() + 1).padStart(2, '0'),
    y: String(today.getFullYear()),
  },
  checksA: {},
  issuerCompany: '',
  folioNo: '',
  holders: [emptyHolder()],
  numFaceValue: '',
  distinctiveFrom: '',
  distinctiveTo: '',
  panAadhaarLinked: 'Yes',
  dematAccount: '',
  addressProof: 'UID',
  bankAccount: '',
  bankName: '',
  branchName: '',
  ifsc: '',
  email: '',
  mobile: '',
  additionalFolios: [],
};

export default function Forms() {
  const [form, setForm] = useState(emptyForm);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const updateHolder = (idx, patch) => {
    const holders = [...form.holders];
    holders[idx] = { ...holders[idx], ...patch };
    update({ holders });
  };

  const addHolder = () => {
    if (form.holders.length >= 3) return;
    update({ holders: [...form.holders, emptyHolder()] });
  };

  const removeHolder = (idx) => {
    update({ holders: form.holders.filter((_, i) => i !== idx) });
  };

  const updateFolio = (idx, patch) => {
    const folios = [...form.additionalFolios];
    folios[idx] = { ...folios[idx], ...patch };
    update({ additionalFolios: folios });
  };

  const addFolio = () => update({ additionalFolios: [...form.additionalFolios, emptyFolio()] });
  const removeFolio = (idx) => update({ additionalFolios: form.additionalFolios.filter((_, i) => i !== idx) });

  const toggleCheckA = (label) =>
    update({ checksA: { ...form.checksA, [label]: !form.checksA[label] } });

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const payload = {
        ...form,
        // Declarations mirror the holders list (name/address/PIN come from
        // the same people who hold the securities).
        declarations: form.holders.map((h) => ({ name: h.name, address: h.address, pin: h.pin })),
      };
      const res = await api.post('/forms/isr1/generate', payload, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ISR-1-${form.issuerCompany || 'filled'}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Could not generate the PDF. Please check the required fields and try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
          <FileText size={22} className="text-primary" />
          Forms — SEBI ISR-1
        </h2>
        <p className="text-sm text-muted mt-1">
          Fill this in once and download a completed ISR-1 PDF in the original SEBI format.
        </p>
      </div>

      {error && <div className="card !border-danger/40 text-sm text-danger">{error}</div>}

      {/* Date + Section A */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-ink">Date &amp; Request Type</h3>
        <div className="grid grid-cols-3 gap-4 max-w-sm">
          <div>
            <label className="label">Day</label>
            <input className="input" value={form.date.d} onChange={(e) => update({ date: { ...form.date, d: e.target.value } })} maxLength={2} />
          </div>
          <div>
            <label className="label">Month</label>
            <input className="input" value={form.date.m} onChange={(e) => update({ date: { ...form.date, m: e.target.value } })} maxLength={2} />
          </div>
          <div>
            <label className="label">Year</label>
            <input className="input" value={form.date.y} onChange={(e) => update({ date: { ...form.date, y: e.target.value } })} maxLength={4} />
          </div>
        </div>
        <div>
          <label className="label">Section A — what are you registering/updating?</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES_A.map((label) => (
              <label key={label} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" checked={!!form.checksA[label]} onChange={() => toggleCheckA(label)} className="accent-[rgb(var(--primary))]" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Section B */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-ink">Security Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Name of the Issuer Company</label>
            <input className="input" value={form.issuerCompany} onChange={(e) => update({ issuerCompany: e.target.value })} />
          </div>
          <div>
            <label className="label">Folio No.</label>
            <input className="input" value={form.folioNo} onChange={(e) => update({ folioNo: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Number &amp; Face value of securities</label>
          <input className="input" placeholder="e.g. 500 Equity Shares of Rs. 10/- each" value={form.numFaceValue} onChange={(e) => update({ numFaceValue: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Distinctive Number — From</label>
            <input className="input" value={form.distinctiveFrom} onChange={(e) => update({ distinctiveFrom: e.target.value })} />
          </div>
          <div>
            <label className="label">Distinctive Number — To</label>
            <input className="input" value={form.distinctiveTo} onChange={(e) => update({ distinctiveTo: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Holders (up to 3) + PAN + Declaration in one, since ISR-1 reuses the same people */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Security Holder(s) &amp; PAN</h3>
          {form.holders.length < 3 && (
            <button type="button" className="btn-secondary !py-1.5 !px-3 text-xs" onClick={addHolder}>
              <Plus size={14} /> Add holder
            </button>
          )}
        </div>
        {form.holders.map((h, idx) => (
          <div key={idx} className="border border-line rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Holder {idx + 1}</p>
              {form.holders.length > 1 && (
                <button type="button" onClick={() => removeHolder(idx)} className="text-danger hover:text-danger/80">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={h.name} onChange={(e) => updateHolder(idx, { name: e.target.value })} />
              </div>
              <div>
                <label className="label">PAN</label>
                <input
                  className="input uppercase"
                  maxLength={10}
                  value={h.pan}
                  onChange={(e) => updateHolder(idx, { pan: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                />
              </div>
            </div>
            <div>
              <label className="label">Full Address (used for the Declaration section)</label>
              <input className="input" value={h.address} onChange={(e) => updateHolder(idx, { address: e.target.value })} />
            </div>
            <div className="w-40">
              <label className="label">PIN Code</label>
              <input className="input" maxLength={6} value={h.pin} onChange={(e) => updateHolder(idx, { pin: e.target.value })} />
            </div>
          </div>
        ))}
        <div>
          <label className="label">PAN linked to Aadhaar?</label>
          <div className="flex gap-4">
            {['Yes', 'No'].map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="radio" name="panAadhaar" checked={form.panAadhaarLinked === v} onChange={() => update({ panAadhaarLinked: v })} className="accent-[rgb(var(--primary))]" />
                {v}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Demat + Address proof */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-ink">Demat Account &amp; Proof of Address</h3>
        <div>
          <label className="label">Demat Account Number (Optional)</label>
          <input className="input" value={form.dematAccount} onChange={(e) => update({ dematAccount: e.target.value })} />
        </div>
        <div>
          <label className="label">Proof of Address being submitted (first holder)</label>
          <div className="space-y-2">
            {ADDRESS_PROOF_OPTIONS.map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 text-sm text-ink cursor-pointer">
                <input type="radio" name="addressProof" className="mt-0.5 accent-[rgb(var(--primary))]" checked={form.addressProof === key} onChange={() => update({ addressProof: key })} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-ink">Bank Details (first holder)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Account Number</label>
            <input className="input" value={form.bankAccount} onChange={(e) => update({ bankAccount: e.target.value })} />
          </div>
          <div>
            <label className="label">Bank Name</label>
            <input className="input" value={form.bankName} onChange={(e) => update({ bankName: e.target.value })} />
          </div>
          <div>
            <label className="label">Branch Name</label>
            <input className="input" value={form.branchName} onChange={(e) => update({ branchName: e.target.value })} />
          </div>
          <div>
            <label className="label">IFSC Code</label>
            <input className="input uppercase" value={form.ifsc} onChange={(e) => update({ ifsc: e.target.value.toUpperCase() })} />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-ink">Contact Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">E-mail Address</label>
            <input className="input" type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} />
          </div>
          <div>
            <label className="label">Mobile Number</label>
            <input className="input" value={form.mobile} onChange={(e) => update({ mobile: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Additional folios */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Additional Folios (Authorization)</h3>
          <button type="button" className="btn-secondary !py-1.5 !px-3 text-xs" onClick={addFolio}>
            <Plus size={14} /> Add folio
          </button>
        </div>
        {form.additionalFolios.length === 0 ? (
          <p className="text-sm text-faint">None added — leave blank if this is your only folio.</p>
        ) : (
          form.additionalFolios.map((f, idx) => (
            <div key={idx} className="border border-line rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Folio {idx + 1}</p>
                <button type="button" onClick={() => removeFolio(idx)} className="text-danger hover:text-danger/80">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Issuer Company</label>
                  <input className="input" value={f.company} onChange={(e) => updateFolio(idx, { company: e.target.value })} />
                </div>
                <div>
                  <label className="label">Folio No.</label>
                  <input className="input" value={f.folioNo} onChange={(e) => updateFolio(idx, { folioNo: e.target.value })} />
                </div>
                <div>
                  <label className="label">Quantity of Securities</label>
                  <input className="input" value={f.qty} onChange={(e) => updateFolio(idx, { qty: e.target.value })} />
                </div>
                <div>
                  <label className="label">Face Value</label>
                  <input className="input" value={f.faceValue} onChange={(e) => updateFolio(idx, { faceValue: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Distinctive Number (Optional)</label>
                  <input className="input" value={f.distinctiveNo} onChange={(e) => updateFolio(idx, { distinctiveNo: e.target.value })} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end pb-8">
        <button className="btn-primary" onClick={generate} disabled={generating}>
          <Download size={16} />
          {generating ? 'Generating…' : 'Generate & Download Filled ISR-1'}
        </button>
      </div>
    </div>
  );
}