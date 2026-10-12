import ExcelJS from 'exceljs';
import { paiseToRupees } from '@/src/domain/money';

export async function generateSingleOrderExcel(
  order: any,
  lines: any[],
  cafeSettings: any
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'XPRSO Order Platform';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Tax Invoice');

  // Title / Café Info
  sheet.addRow([cafeSettings?.cafeName || 'XPRSO Café']);
  sheet.addRow([cafeSettings?.address || '']);
  if (cafeSettings?.gstin) sheet.addRow([`GSTIN: ${cafeSettings.gstin}`]);
  if (cafeSettings?.phone) sheet.addRow([`Phone: ${cafeSettings.phone}`]);
  sheet.addRow([]);

  // Invoice Meta
  sheet.addRow(['Invoice No:', order.invoiceNo || 'DRAFT']);
  sheet.addRow(['Date:', new Date(order.settledAt || order.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })]);
  sheet.addRow(['Order Type:', order.orderType === 'DINE_IN' ? `Dine-in (${order.tableLabel || 'Table'})` : 'Takeaway']);
  sheet.addRow(['Payment Mode:', order.paymentMode || 'PENDING']);
  sheet.addRow([]);

  // Table Headers
  const headerRow = sheet.addRow([
    'Item #',
    'Item Description',
    'Category',
    'Qty',
    'Unit Price (₹)',
    'Taxable Value (₹)',
    'Tax (₹)',
    'Total (₹)',
  ]);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };

  // Line items
  lines.forEach((line, idx) => {
    const row = sheet.addRow([
      idx + 1,
      line.productNameSnapshot,
      line.categoryNameSnapshot,
      line.qty,
      paiseToRupees(line.unitPricePaise),
      paiseToRupees(line.lineTaxablePaise),
      paiseToRupees(line.lineTaxPaise),
      paiseToRupees(line.lineAmountPaise + line.lineTaxPaise),
    ]);

    // Number formats for currency columns
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '₹#,##0.00';
    row.getCell(6).numFmt = '₹#,##0.00';
    row.getCell(7).numFmt = '₹#,##0.00';
    row.getCell(8).numFmt = '₹#,##0.00';
  });

  sheet.addRow([]);

  // Summary Totals
  const subtotalRow = sheet.addRow(['', '', '', '', '', 'Subtotal:', paiseToRupees(order.subtotalPaise)]);
  subtotalRow.font = { bold: true };
  subtotalRow.getCell(7).numFmt = '₹#,##0.00';

  if (order.serviceChargePaise > 0) {
    const serviceRow = sheet.addRow(['', '', '', '', '', 'Service Charge:', paiseToRupees(order.serviceChargePaise)]);
    serviceRow.getCell(7).numFmt = '₹#,##0.00';
  }

  if (order.cgstPaise > 0) {
    const cgstRow = sheet.addRow(['', '', '', '', '', 'CGST:', paiseToRupees(order.cgstPaise)]);
    cgstRow.getCell(7).numFmt = '₹#,##0.00';
    const sgstRow = sheet.addRow(['', '', '', '', '', 'SGST:', paiseToRupees(order.sgstPaise)]);
    sgstRow.getCell(7).numFmt = '₹#,##0.00';
  } else if (order.igstOrGstPaise > 0) {
    const gstRow = sheet.addRow(['', '', '', '', '', 'GST:', paiseToRupees(order.igstOrGstPaise)]);
    gstRow.getCell(7).numFmt = '₹#,##0.00';
  }

  if (order.roundOffPaise !== 0) {
    const roundRow = sheet.addRow(['', '', '', '', '', 'Round Off:', paiseToRupees(order.roundOffPaise)]);
    roundRow.getCell(7).numFmt = '₹#,##0.00';
  }

  const grandRow = sheet.addRow(['', '', '', '', '', 'GRAND TOTAL:', paiseToRupees(order.grandTotalPaise)]);
  grandRow.font = { bold: true, size: 12 };
  grandRow.getCell(7).numFmt = '₹#,##0.00';

  // Auto column widths
  sheet.columns.forEach((col) => {
    col.width = Math.max(12, (col.values?.length || 10) + 2);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateDateRangeExcelReport(data: {
  orders: any[];
  lines: any[];
  products: any[];
  taxDaily: any[];
  from: string;
  to: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'XPRSO Analytics Export';
  workbook.created = new Date();

  // 1. Orders Sheet
  const ordersSheet = workbook.addWorksheet('Orders');
  ordersSheet.addRow([
    'Invoice No',
    'Date & Time',
    'Type',
    'Table',
    'Payment Mode',
    'Subtotal (₹)',
    'CGST (₹)',
    'SGST (₹)',
    'Grand Total (₹)',
  ]).font = { bold: true };

  data.orders.forEach((o) => {
    const row = ordersSheet.addRow([
      o.invoiceNo || 'DRAFT',
      new Date(o.settledAt || o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      o.orderType,
      o.tableLabel || '-',
      o.paymentMode || '-',
      paiseToRupees(o.subtotalPaise),
      paiseToRupees(o.cgstPaise),
      paiseToRupees(o.sgstPaise),
      paiseToRupees(o.grandTotalPaise),
    ]);
    row.getCell(6).numFmt = '₹#,##0.00';
    row.getCell(7).numFmt = '₹#,##0.00';
    row.getCell(8).numFmt = '₹#,##0.00';
    row.getCell(9).numFmt = '₹#,##0.00';
  });

  // 2. Lines Sheet (with Cost & Gross Profit)
  const linesSheet = workbook.addWorksheet('Lines');
  linesSheet.addRow([
    'Invoice No',
    'Product',
    'Category',
    'Qty',
    'Unit Price (₹)',
    'Taxable (₹)',
    'Tax (₹)',
    'Item Cost (₹)',
    'Gross Profit (₹)',
  ]).font = { bold: true };

  data.lines.forEach((l) => {
    const row = linesSheet.addRow([
      l.invoiceNo || '-',
      l.productNameSnapshot,
      l.categoryNameSnapshot,
      l.qty,
      paiseToRupees(l.unitPricePaise),
      paiseToRupees(l.lineTaxablePaise),
      paiseToRupees(l.lineTaxPaise),
      l.lineCostPaise != null ? paiseToRupees(l.lineCostPaise) : '-',
      l.lineGrossProfitPaise != null ? paiseToRupees(l.lineGrossProfitPaise) : '-',
    ]);
    row.getCell(5).numFmt = '₹#,##0.00';
    row.getCell(6).numFmt = '₹#,##0.00';
    row.getCell(7).numFmt = '₹#,##0.00';
    if (l.lineCostPaise != null) row.getCell(8).numFmt = '₹#,##0.00';
    if (l.lineGrossProfitPaise != null) row.getCell(9).numFmt = '₹#,##0.00';
  });

  // 3. Products Sheet
  const productsSheet = workbook.addWorksheet('Products');
  productsSheet.addRow([
    'Product',
    'Category',
    'Qty Sold',
    'Revenue (Taxable ₹)',
    'Total Cost (₹)',
    'Gross Profit (₹)',
    'Margin %',
  ]).font = { bold: true };

  data.products.forEach((p) => {
    const row = productsSheet.addRow([
      p.productName,
      p.categoryName || '-',
      p.qtySold,
      paiseToRupees(p.revenuePaise),
      p.totalCostPaise != null ? paiseToRupees(p.totalCostPaise) : '-',
      p.grossProfitPaise != null ? paiseToRupees(p.grossProfitPaise) : '-',
      p.marginPct != null ? `${p.marginPct.toFixed(1)}%` : 'Unknown',
    ]);
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '₹#,##0.00';
    if (p.totalCostPaise != null) row.getCell(5).numFmt = '₹#,##0.00';
    if (p.grossProfitPaise != null) row.getCell(6).numFmt = '₹#,##0.00';
  });

  // 4. Tax Daily Sheet
  const taxSheet = workbook.addWorksheet('Tax Daily');
  taxSheet.addRow(['Date', 'Taxable Value (₹)', 'CGST (₹)', 'SGST (₹)', 'Total Tax (₹)']).font = { bold: true };
  data.taxDaily.forEach((t) => {
    const row = taxSheet.addRow([
      t.day,
      paiseToRupees(t.taxablePaise),
      paiseToRupees(t.cgstPaise),
      paiseToRupees(t.sgstPaise),
      paiseToRupees(t.totalTaxPaise),
    ]);
    row.getCell(2).numFmt = '₹#,##0.00';
    row.getCell(3).numFmt = '₹#,##0.00';
    row.getCell(4).numFmt = '₹#,##0.00';
    row.getCell(5).numFmt = '₹#,##0.00';
  });

  // Auto width for all sheets
  workbook.worksheets.forEach((s) => {
    s.columns.forEach((col) => {
      col.width = 16;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
