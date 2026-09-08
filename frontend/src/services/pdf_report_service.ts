import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DeterministicAnalysisReport } from '../types';

const BRAND_RED: [number, number, number] = [220, 38, 38];
const DARK: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [110, 110, 110];

export function generateStockReportPdf(report: DeterministicAnalysisReport): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 50;

  const currentPrice = report.chart_data.close[report.chart_data.close.length - 1];
  const activeRec = report.prediction?.recommendation || report.recommendation || report.scores?.recommendation || 'HOLD';

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  doc.text('STONKS — Equity Research Report', margin, y);
  y += 20;

  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
  y += 25;

  // Ticker / price block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text(`${report.company_name} (${report.ticker})`, margin, y);
  y += 24;

  doc.setFontSize(16);
  doc.text(`Rs. ${currentPrice.toFixed(2)}`, margin, y);

  doc.setFontSize(12);
  doc.setTextColor(...BRAND_RED);
  doc.text(activeRec, margin + 130, y);
  doc.setTextColor(...DARK);
  y += 30;

  // Key metrics table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Metric', 'Value']],
    body: [
      ['Overall Score', `${report.scores.overall_score.toFixed(1)} / 100`],
      ['Confidence', `${(report.scores.confidence ?? 0).toFixed(0)}%`],
      ['Risk Level', report.risk_profile.level],
      ['Annualized Volatility', `${report.risk_profile.annualized_volatility.toFixed(1)}%`],
      ['VIX Regime', report.risk_profile.vix_regime],
      ...(report.prediction?.target_price ? [['Target Price', `Rs. ${report.prediction.target_price.toFixed(2)}`]] : []),
      ...(report.prediction?.stop_loss ? [['Stop Loss', `Rs. ${report.prediction.stop_loss.toFixed(2)}`]] : []),
      ...(report.prediction?.expected_move_pct !== undefined ? [['Expected Move', `${report.prediction.expected_move_pct >= 0 ? '+' : ''}${report.prediction.expected_move_pct}%`]] : []),
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND_RED, textColor: [255, 255, 255], fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    styles: { cellPadding: 6 },
  });
  y = (doc as any).lastAutoTable.finalY + 25;

  // Technical score breakdown
  const scoreRows: [string, string, string][] = [
    ['Trend', report.scores.trend.value.toFixed(0), `${(report.scores.trend.weight * 100).toFixed(0)}%`],
    ['Momentum', report.scores.momentum.value.toFixed(0), `${(report.scores.momentum.weight * 100).toFixed(0)}%`],
    ['Volume', report.scores.volume.value.toFixed(0), `${(report.scores.volume.weight * 100).toFixed(0)}%`],
    ['Volatility', report.scores.volatility.value.toFixed(0), `${(report.scores.volatility.weight * 100).toFixed(0)}%`],
    ['Pattern', report.scores.pattern.value.toFixed(0), `${(report.scores.pattern.weight * 100).toFixed(0)}%`],
    ['Support', report.scores.support.value.toFixed(0), `${(report.scores.support.weight * 100).toFixed(0)}%`],
    ['Resistance', report.scores.resistance.value.toFixed(0), `${(report.scores.resistance.weight * 100).toFixed(0)}%`],
    ['Market', report.scores.market.value.toFixed(0), `${(report.scores.market.weight * 100).toFixed(0)}%`],
    ['Sector', report.scores.sector.value.toFixed(0), `${(report.scores.sector.weight * 100).toFixed(0)}%`],
    ['Risk', report.scores.risk.value.toFixed(0), `${(report.scores.risk.weight * 100).toFixed(0)}%`],
  ];

  if (y > 650) { doc.addPage(); y = 50; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Technical Score Breakdown', margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Component', 'Score (0-100)', 'Weight']],
    body: scoreRows,
    theme: 'striped',
    headStyles: { fillColor: DARK, fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    styles: { cellPadding: 5 },
  });
  y = (doc as any).lastAutoTable.finalY + 25;

  // Factors
  const addBulletSection = (title: string, items: string[], color: [number, number, number]) => {
    if (!items || items.length === 0) return;
    if (y > 700) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(title, margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    items.slice(0, 6).forEach(item => {
      const lines = doc.splitTextToSize(`- ${item}`, pageWidth - margin * 2 - 10);
      lines.forEach((line: string) => {
        if (y > 780) { doc.addPage(); y = 50; }
        doc.text(line, margin + 8, y);
        y += 13;
      });
    });
    y += 10;
  };

  addBulletSection('Bull Case', report.positive_factors, [16, 150, 80]);
  addBulletSection('Bear Case', report.negative_factors, [220, 38, 38]);
  addBulletSection('Neutral Factors', report.neutral_factors, [150, 130, 20]);

  // Support / Resistance zones
  if ((report.support_zones?.length || report.resistance_zones?.length)) {
    if (y > 650) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...DARK);
    doc.text('Support & Resistance Zones', margin, y);
    y += 10;

    const srRows = [
      ...report.support_zones.map(z => ['Support', `Rs. ${z.lower_bound.toFixed(2)} - ${z.upper_bound.toFixed(2)}`, `Strength: ${z.strength ?? '-'} | Touches: ${z.touches ?? '-'}`]),
      ...report.resistance_zones.map(z => ['Resistance', `Rs. ${z.lower_bound.toFixed(2)} - ${z.upper_bound.toFixed(2)}`, `Strength: ${z.strength ?? '-'} | Touches: ${z.touches ?? '-'}`]),
    ];
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Type', 'Price Level', 'Notes']],
      body: srRows,
      theme: 'grid',
      headStyles: { fillColor: DARK, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      styles: { cellPadding: 5 },
    });
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  // Disclaimer
  if (y > 720) { doc.addPage(); y = 50; }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const disclaimer = doc.splitTextToSize(
    'This report is generated by an automated quantitative model for informational purposes only. It is not investment advice, a recommendation, or a solicitation to buy or sell any security. Past performance and backtested results are not indicative of future returns. Consult a licensed financial advisor before making investment decisions.',
    pageWidth - margin * 2
  );
  doc.text(disclaimer, margin, y);

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`${report.ticker.replace('.', '_')}_report_${dateStr}.pdf`);
}
