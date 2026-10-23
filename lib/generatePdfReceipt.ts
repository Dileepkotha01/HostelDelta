/**
 * generatePdfReceipt.ts
 * PDFKit-based professional rent payment receipt generator for Hostelhood.
 * Produces a styled, structured PDF with hostel branding, tenant info,
 * financial table, and PAID & VERIFIED badge.
 */

import PDFDocument from 'pdfkit';
import type { PaymentReceipt } from '@/lib/types';

// Palette
const COLORS = {
  primary: '#4F46E5',       // Indigo
  primaryLight: '#818CF8',
  success: '#059669',       // Emerald
  successLight: '#D1FAE5',
  dark: '#0F172A',
  mid: '#334155',
  muted: '#64748B',
  light: '#F1F5F9',
  white: '#FFFFFF',
  border: '#E2E8F0',
  accent: '#06B6D4',        // Cyan
};

function formatINR(amount: number): string {
  return `INR ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Generates a professional PDF receipt buffer for a given PaymentReceipt record.
 * Returns a Buffer containing the PDF binary data.
 */
export async function generatePdfReceipt(receipt: PaymentReceipt): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 48, right: 48 },
      info: {
        Title: `Receipt ${receipt.receipt_number}`,
        Author: receipt.hostel_name,
        Subject: 'Rent Payment Receipt',
        Creator: 'Hostelhood Platform',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 96; // Usable width (margin 48 each side)
    const L = 48; // Left margin

    // ─────────────────────────────────────────
    // HEADER BAND — Hostel Branding
    // ─────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 110).fill(COLORS.primary);

    // Hostel name
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(22)
      .text(receipt.hostel_name.toUpperCase(), L, 24, { width: W - 120 });

    // Contact row
    doc.fillColor('#C7D2FE').font('Helvetica').fontSize(8.5)
      .text(`${receipt.hostel_address}`, L, 52, { width: W - 120 })
      .text(`Phone: ${receipt.hostel_phone}${receipt.hostel_gstin ? `   GSTIN: ${receipt.hostel_gstin}` : ''}`, L, 64, { width: W - 120 });

    // PAID badge (top-right)
    doc.roundedRect(doc.page.width - 140, 22, 100, 38, 6)
      .fill(COLORS.success);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(13)
      .text('✓ PAID', doc.page.width - 135, 33, { width: 90, align: 'center' });

    // ─────────────────────────────────────────
    // RECEIPT TITLE + NUMBER
    // ─────────────────────────────────────────
    let y = 130;

    doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(14)
      .text('RENT PAYMENT RECEIPT', L, y);

    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
      .text(`Receipt No: ${receipt.receipt_number}`, L, y + 18)
      .text(`Date & Time: ${formatDateTime(receipt.created_at)}`, L + 200, y + 18);

    y += 44;

    // Separator
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor(COLORS.border).lineWidth(1).stroke();
    y += 14;

    // ─────────────────────────────────────────
    // TENANT & STAY DETAILS (2-column box)
    // ─────────────────────────────────────────
    doc.rect(L, y, W, 90).fill(COLORS.light).stroke(COLORS.border);

    const col1 = L + 14;
    const col2 = L + W / 2 + 10;
    const labelY = y + 12;

    // Left column — Tenant
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text('TENANT DETAILS', col1, labelY);

    doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(10)
      .text(receipt.tenant_name, col1, labelY + 12);

    doc.fillColor(COLORS.mid).font('Helvetica').fontSize(8.5)
      .text(`Mobile: ${receipt.tenant_phone}`, col1, labelY + 27)
      .text(`Email: ${receipt.tenant_email || '—'}`, col1, labelY + 40);

    // Right column — Stay
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text('STAY DETAILS', col2, labelY);

    doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(10)
      .text(`Room No. ${receipt.room_number}`, col2, labelY + 12);

    doc.fillColor(COLORS.mid).font('Helvetica').fontSize(8.5)
      .text(`Rent Period: ${receipt.rent_month} ${receipt.rent_year}`, col2, labelY + 27)
      .text(`Hostel: ${receipt.hostel_name}`, col2, labelY + 40);

    y += 104;

    // ─────────────────────────────────────────
    // FINANCIAL TABLE
    // ─────────────────────────────────────────
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text('PAYMENT BREAKDOWN', L, y);
    y += 10;

    // Table header
    doc.rect(L, y, W, 22).fill(COLORS.primary);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(8.5)
      .text('Description', col1, y + 7, { width: 260 })
      .text('Period', L + 310, y + 7, { width: 90 })
      .text('Amount', L + W - 90, y + 7, { width: 90, align: 'right' });
    y += 22;

    // Table row
    doc.rect(L, y, W, 26).fill(COLORS.white).stroke(COLORS.border);
    doc.fillColor(COLORS.dark).font('Helvetica').fontSize(9)
      .text(`Monthly Room Rent — Room #${receipt.room_number}`, col1, y + 8, { width: 260 })
      .text(`${receipt.rent_month} ${receipt.rent_year}`, L + 310, y + 8, { width: 90 })
      .text(formatINR(receipt.amount_paid), L + W - 90, y + 8, { width: 90, align: 'right' });
    y += 26;

    // Subtotal row
    doc.rect(L, y, W, 22).fill(COLORS.light).stroke(COLORS.border);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text('Platform Commission', col1, y + 7, { width: 260 })
      .text('₹0.00', L + W - 90, y + 7, { width: 90, align: 'right' });
    y += 22;

    // ─────────────────────────────────────────
    // TOTAL BANNER
    // ─────────────────────────────────────────
    y += 4;
    doc.rect(L, y, W, 44).fill(COLORS.success);
    doc.fillColor(COLORS.white).font('Helvetica').fontSize(9)
      .text('TOTAL AMOUNT PAID', col1, y + 8);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(18)
      .text(formatINR(receipt.amount_paid), L + W - 200, y + 8, { width: 188, align: 'right' });
    doc.fillColor(COLORS.successLight).font('Helvetica').fontSize(7.5)
      .text('Zero platform commission • 100% to hostel owner', col1, y + 28);
    y += 58;

    // ─────────────────────────────────────────
    // VERIFICATION DETAILS BOX
    // ─────────────────────────────────────────
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text('VERIFICATION DETAILS', L, y);
    y += 10;

    doc.rect(L, y, W, 80).fill(COLORS.light).stroke(COLORS.border);

    const vLabelX = col1;
    const vValX = L + 180;
    const vRow = (label: string, value: string, rowY: number) => {
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(label, vLabelX, rowY);
      doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(8.5).text(value, vValX, rowY, { width: W - 145 });
    };

    vRow('Payment Method', receipt.payment_method?.toUpperCase() || '—', y + 10);
    vRow('Razorpay Payment ID', receipt.razorpay_payment_id, y + 26);
    vRow('Bank UTR / Ref No.', receipt.bank_utr || 'Pending (T+1)', y + 42);
    vRow('Status', '✓  VERIFIED & PAID', y + 58);

    // Override status color to green
    doc.fillColor(COLORS.success).font('Helvetica-Bold').fontSize(8.5)
      .text('✓  VERIFIED & PAID', vValX, y + 58, { width: W - 145 });

    y += 94;

    // ─────────────────────────────────────────
    // FOOTER DISCLAIMER
    // ─────────────────────────────────────────
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    y += 8;

    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7)
      .text(
        'This is a computer-generated receipt and does not require a physical signature. ' +
        'This receipt is issued by ' + receipt.hostel_name + ' via the Hostelhood platform. ' +
        'For disputes, contact the hostel directly or write to support@hostelhood.in. ' +
        'Zero platform commission policy applies — 100% of rent is transferred to the hostel owner.',
        L, y, { width: W, align: 'center', lineGap: 2 }
      );

    doc.end();
  });
}
