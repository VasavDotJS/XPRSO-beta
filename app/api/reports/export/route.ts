import { NextRequest, NextResponse } from 'next/server';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { generateDateRangeExcelReport } from '@/src/server/export/excel';
import {
  getProductSales,
  getDailyTrend,
  DateRange,
} from '@/src/server/analytics';
import { pool } from '@/src/server/db/client';

export async function GET(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'xlsx';
  const fromStr = url.searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const toStr = url.searchParams.get('to') || new Date().toISOString();

  const range: DateRange = {
    from: new Date(fromStr),
    to: new Date(toStr),
  };

  const client = await pool.connect();
  try {
    // 1. Fetch Orders in range
    const ordersRes = await client.query(
      `
      SELECT
        id, invoice_no, settled_at, created_at, order_type, table_label,
        payment_mode, subtotal_paise, cgst_paise, sgst_paise, grand_total_paise
      FROM orders
      WHERE status = 'SETTLED'
        AND settled_at >= $1 AND settled_at <= $2
      ORDER BY settled_at DESC
      `,
      [range.from, range.to]
    );

    // 2. Fetch Lines in range
    const linesRes = await client.query(
      `
      SELECT
        ol.id, o.invoice_no, ol.product_name_snapshot, ol.category_name_snapshot,
        ol.qty, ol.unit_price_paise, ol.line_taxable_paise, ol.line_tax_paise,
        ol.line_cost_paise, ol.line_gross_profit_paise
      FROM orders o
      JOIN order_lines ol ON o.id = ol.order_id
      WHERE o.status = 'SETTLED'
        AND o.settled_at >= $1 AND o.settled_at <= $2
      ORDER BY o.settled_at DESC
      `,
      [range.from, range.to]
    );

    // 3. Fetch Product Aggregates
    const productsData = await getProductSales(range);

    // 4. Fetch Daily Tax
    const dailyTax = await getDailyTrend(range);

    const fromDateOnly = range.from.toISOString().slice(0, 10);
    const toDateOnly = range.to.toISOString().slice(0, 10);
    const filename = `sales_${fromDateOnly}_to_${toDateOnly}.xlsx`;

    const excelBuffer = await generateDateRangeExcelReport({
      orders: ordersRes.rows.map((r) => ({
        invoiceNo: r.invoice_no,
        settledAt: r.settled_at,
        createdAt: r.created_at,
        orderType: r.order_type,
        tableLabel: r.table_label,
        paymentMode: r.payment_mode,
        subtotalPaise: Number(r.subtotal_paise),
        cgstPaise: Number(r.cgst_paise),
        sgstPaise: Number(r.sgst_paise),
        grandTotalPaise: Number(r.grand_total_paise),
      })),
      lines: linesRes.rows.map((r) => ({
        invoiceNo: r.invoice_no,
        productNameSnapshot: r.product_name_snapshot,
        categoryNameSnapshot: r.category_name_snapshot,
        qty: Number(r.qty),
        unitPricePaise: Number(r.unit_price_paise),
        lineTaxablePaise: Number(r.line_taxable_paise),
        lineTaxPaise: Number(r.line_tax_paise),
        lineCostPaise: r.line_cost_paise != null ? Number(r.line_cost_paise) : null,
        lineGrossProfitPaise: r.line_gross_profit_paise != null ? Number(r.line_gross_profit_paise) : null,
      })),
      products: productsData,
      taxDaily: dailyTax.map((t) => ({
        day: t.day,
        taxablePaise: t.revenuePaise,
        cgstPaise: Math.round(t.taxPaise / 2),
        sgstPaise: t.taxPaise - Math.round(t.taxPaise / 2),
        totalTaxPaise: t.taxPaise,
      })),
      from: fromDateOnly,
      to: toDateOnly,
    });

    return new NextResponse(excelBuffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } finally {
    client.release();
  }
}
