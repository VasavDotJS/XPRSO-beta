import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/server/db/client';
import { orders, orderLines, settings } from '@/src/server/db/schema';
import { requireWaiter } from '@/src/server/auth/rbac';
import { generateOrderPdf } from '@/src/server/export/pdf';
import { generateSingleOrderExcel } from '@/src/server/export/excel';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWaiter(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'pdf';
  const layout = (url.searchParams.get('layout') as 'a4' | 'receipt') || 'a4';

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));
  const [cafeSettings] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);

  const safeInvoiceNo = (order.invoiceNo || `draft_${order.id.slice(0, 8)}`).replace(/[/\\?%*:|"<>]/g, '-');

  if (format === 'xlsx') {
    const excelBuffer = await generateSingleOrderExcel(order, lines, cafeSettings);
    return new NextResponse(excelBuffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeInvoiceNo}.xlsx"`,
      },
    });
  }

  // Default to PDF
  const pdfBuffer = await generateOrderPdf(order, lines, cafeSettings, layout);
  return new NextResponse(pdfBuffer as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeInvoiceNo}.pdf"`,
    },
  });
}
