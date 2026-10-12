import { NextRequest, NextResponse } from 'next/server';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import {
  getKpis,
  getHighlights,
  getTopProducts,
  getBottomProducts,
  getProductSales,
  getOrderProfits,
  getLineProfits,
  getHourlyHeatmap,
  getDailyTrend,
  DateRange,
} from '@/src/server/analytics';

function parseDateRange(url: URL): DateRange {
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const preset = url.searchParams.get('preset');

  const now = new Date();

  if (preset === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { from, to };
  }

  if (preset === 'yesterday') {
    const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const from = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0);
    const to = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59);
    return { from, to };
  }

  if (preset === 'week') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from, to: now };
  }

  if (preset === 'month') {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to: now };
  }

  const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : now;

  return { from, to };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const { section } = await params;
  const url = new URL(req.url);
  const range = parseDateRange(url);

  try {
    switch (section) {
      case 'kpis': {
        const kpis = await getKpis(range);
        return NextResponse.json({ kpis, range });
      }
      case 'highlights': {
        const highlights = await getHighlights(range);
        return NextResponse.json({ highlights, range });
      }
      case 'top': {
        const by = (url.searchParams.get('by') as any) || 'qty';
        const limit = parseInt(url.searchParams.get('limit') || '5', 10);
        const top = await getTopProducts(range, by, limit);
        return NextResponse.json({ top, range });
      }
      case 'bottom': {
        const limit = parseInt(url.searchParams.get('limit') || '5', 10);
        const bottom = await getBottomProducts(range, limit);
        return NextResponse.json({ bottom, range });
      }
      case 'products': {
        const products = await getProductSales(range);
        return NextResponse.json({ products, range });
      }
      case 'orders': {
        const limit = parseInt(url.searchParams.get('limit') || '25', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const orders = await getOrderProfits(range, limit, offset);
        return NextResponse.json({ orders, range });
      }
      case 'lines': {
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const lines = await getLineProfits(range, limit, offset);
        return NextResponse.json({ lines, range });
      }
      case 'hourly': {
        const hourly = await getHourlyHeatmap(range);
        return NextResponse.json({ hourly, range });
      }
      case 'trend': {
        const trend = await getDailyTrend(range);
        return NextResponse.json({ trend, range });
      }
      default:
        return NextResponse.json({ error: `Unknown analytics section: ${section}` }, { status: 404 });
    }
  } catch (err) {
    console.error(`Analytics error in section ${section}:`, err);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}
