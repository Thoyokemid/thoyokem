import jsPDF from 'jspdf';
import { LeaveAttendance } from '@/types';
import { countLeaveDays } from './attendance';

const CATEGORY_LABELS: Record<string, string> = {
  sick: 'Cuti Sakit',
  annual: 'Cuti Tahunan',
  personal: 'Cuti Pribadi',
  emergency: 'Cuti Darurat',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function generateLeaveLetterPDF(
  leave: LeaveAttendance,
  opts: { quota: number; usedDays: number }
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 25;
  let y = 25;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('THOYOKEM INDONESIA', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Surat Keterangan Cuti Karyawan', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 12;

  const days = countLeaveDays(leave);
  const remainingAfter = Math.max(0, opts.quota - opts.usedDays);

  doc.setFontSize(11);
  doc.text(
    `Yang bertanda tangan di bawah ini menerangkan bahwa karyawan berikut telah mengajukan dan disetujui untuk mengambil cuti:`,
    marginX,
    y,
    { maxWidth: pageWidth - marginX * 2 }
  );
  y += 14;

  const rows: [string, string][] = [
    ['Nama Karyawan', leave.name],
    ['Jenis Cuti', CATEGORY_LABELS[leave.category] || leave.category],
    ['Tanggal Mulai', formatDate(leave.date_from)],
    ['Tanggal Selesai', formatDate(leave.date_end)],
    ['Jumlah Hari', `${days} hari`],
    ['Keterangan', leave.keterangan || '-'],
    ['Sisa Kuota Cuti Tahun Ini', `${remainingAfter} dari ${opts.quota} hari`],
  ];

  const labelWidth = 55;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`: ${value}`, marginX + labelWidth, y, { maxWidth: pageWidth - marginX - labelWidth - marginX });
    y += 8;
  });

  y += 10;
  doc.text(
    'Surat ini dibuat secara otomatis oleh sistem sebagai bukti pengajuan cuti dan dapat digunakan sebagai referensi administrasi internal.',
    marginX,
    y,
    { maxWidth: pageWidth - marginX * 2 }
  );

  y += 25;
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Dikeluarkan pada: ${today}`, pageWidth - marginX, y, { align: 'right' });
  y += 25;
  doc.text('HRD Thoyokem Indonesia', pageWidth - marginX, y, { align: 'right' });

  doc.save(`Surat_Cuti_${leave.name.replace(/\s+/g, '_')}_${leave.date_from}.pdf`);
}
