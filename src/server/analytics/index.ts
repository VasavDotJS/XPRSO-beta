import { pool } from '../db/client';
import { formatINR, formatBps } from '@/src/domain/money';

export interface DateRange {
  from: Date;
  to: Date;
  timezone?: string;
}

export interface KpisResult {
  ordersCount: number;
  itemsSoldCount: number;
  revenuePaise: number; // taxable value, excluding GST
  gstCollectedPaise: number;
  grossProfitPaise: number;
  averageOrderValuePaise: number;
  linesWithMissingCostCount: number;
}

export interface ProductSaleStat {
  productId: string;
  productName: string;
  categoryName: string;
  qtySold: number;
  revenuePaise: number;
  totalCostPaise: number | null;
  grossProfitPaise: number | null;
  marginPct: number | null;
  shareOfQtyPct: number;
  hasMissingCost: boolean;
}

export interface HighlightItem {
  kind: 'best_seller' | 'top_profit' | 'zero_sales' | 'low_margin' | 'busiest_hour' | 'period_growth' | 'missing_cost';
  text: string;
}

/**
 * Deterministic KPI Aggregates via SQL
 */
export async function getKpis(range: DateRange): Promise<KpisResult> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `
      SELECT
        COUNT(DISTINCT o.id)::int as orders_count,
        COALESCE(SUM(ol.qty), 0)::int as items_sold_count,
        COALESCE(SUM(ol.line_taxable_paise), 0)::bigint as revenue_paise,
        COALESCE(SUM(ol.line_tax_paise), 0)::bigint as gst_collected_paise,
        COALESCE(SUM(ol.line_gross_profit_paise), 0)::bigint as gross_profit_paise,
        COUNT(CASE WHEN ol.unit_cost_paise IS NULL THEN 1 END)::int as missing_cost_count
      FROM orders o
      JOIN order_lines ol ON o.id = ol.order_id
      WHERE o.status = 'SETTLED'
        AND o.settled_at >= $1
        AND o.settled_at <= $2
      `,
      [range.from, range.to]
    );

    const row = res.rows[0];
    const ordersCount = Number(row.orders_count || 0);
    const revenuePaise = Number(row.revenue_paise || 0);
    const aov = ordersCount > 0 ? Math.round(revenuePaise / ordersCount) : 0;

    return {
      ordersCount,
      itemsSoldCount: Number(row.items_sold_count || 0),
      revenuePaise,
      gstCollectedPaise: Number(row.gst_collected_paise || 0),
      grossProfitPaise: Number(row.gross_profit_paise || 0),
      averageOrderValuePaise: aov,
      linesWithMissingCostCount: Number(row.missing_cost_count || 0),
    };
  } finally {
    client.release();
  }
}

/**
 * Top N Products by qty, revenue, or profit
 */
export async function getTopProducts(
  range: DateRange,
  by: 'qty' | 'revenue' | 'profit' = 'qty',
  limit: number = 5
): Promise<ProductSaleStat[]> {
  const client = await pool.connect();
  try {
    const orderByCol =
      by === 'revenue'
        ? 'revenue_paise DESC'
        : by === 'profit'
        ? 'gross_profit_paise DESC NULLS LAST'
        : 'qty_sold DESC';

    const res = await client.query(
      `
      WITH sales AS (
        SELECT
          ol.product_id,
          ol.product_name_snapshot,
          ol.category_name_snapshot,
          SUM(ol.qty)::int as qty_sold,
          SUM(ol.line_taxable_paise)::bigint as revenue_paise,
          SUM(ol.line_cost_paise)::bigint as total_cost_paise,
          SUM(ol.line_gross_profit_paise)::bigint as gross_profit_paise,
          BOOL_OR(ol.unit_cost_paise IS NULL) as has_missing_cost
        FROM orders o
        JOIN order_lines ol ON o.id = ol.order_id
        WHERE o.status = 'SETTLED'
          AND o.settled_at >= $1
          AND o.settled_at <= $2
        GROUP BY ol.product_id, ol.product_name_snapshot, ol.category_name_snapshot
      ),
      totals AS (
        SELECT COALESCE(SUM(qty_sold), 0)::float as total_qty FROM sales
      )
      SELECT
        s.*,
        CASE
          WHEN s.revenue_paise > 0 AND s.gross_profit_paise IS NOT NULL
          THEN ROUND((s.gross_profit_paise::numeric / s.revenue_paise::numeric) * 100, 1)
          ELSE NULL
        END as margin_pct,
        CASE
          WHEN t.total_qty > 0 THEN ROUND((s.qty_sold::numeric / t.total_qty::numeric) * 100, 1)
          ELSE 0
        END as share_of_qty_pct
      FROM sales s, totals t
      ORDER BY ${orderByCol}
      LIMIT $3
      `,
      [range.from, range.to, limit]
    );

    return res.rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name_snapshot,
      categoryName: r.category_name_snapshot,
      qtySold: Number(r.qty_sold),
      revenuePaise: Number(r.revenue_paise),
      totalCostPaise: r.total_cost_paise != null ? Number(r.total_cost_paise) : null,
      grossProfitPaise: r.gross_profit_paise != null ? Number(r.gross_profit_paise) : null,
      marginPct: r.margin_pct != null ? parseFloat(r.margin_pct) : null,
      shareOfQtyPct: parseFloat(r.share_of_qty_pct || 0),
      hasMissingCost: Boolean(r.has_missing_cost),
    }));
  } finally {
    client.release();
  }
}

/**
 * Bottom N Products — CRUCIAL: LEFT JOIN from active products to include ZERO-SALE items!
 */
export async function getBottomProducts(
  range: DateRange,
  limit: number = 5
): Promise<ProductSaleStat[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `
      WITH sales AS (
        SELECT
          ol.product_id,
          SUM(ol.qty)::int as qty_sold,
          SUM(ol.line_taxable_paise)::bigint as revenue_paise,
          SUM(ol.line_cost_paise)::bigint as total_cost_paise,
          SUM(ol.line_gross_profit_paise)::bigint as gross_profit_paise,
          BOOL_OR(ol.unit_cost_paise IS NULL) as has_missing_cost
        FROM orders o
        JOIN order_lines ol ON o.id = ol.order_id
        WHERE o.status = 'SETTLED'
          AND o.settled_at >= $1
          AND o.settled_at <= $2
        GROUP BY ol.product_id
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        COALESCE(c.name, 'General') as category_name,
        COALESCE(s.qty_sold, 0)::int as qty_sold,
        COALESCE(s.revenue_paise, 0)::bigint as revenue_paise,
        s.total_cost_paise,
        s.gross_profit_paise,
        COALESCE(s.has_missing_cost, false) as has_missing_cost
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sales s ON p.id = s.product_id
      WHERE p.is_archived = false
      ORDER BY qty_sold ASC, revenue_paise ASC, p.name ASC
      LIMIT $3
      `,
      [range.from, range.to, limit]
    );

    return res.rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      categoryName: r.category_name,
      qtySold: Number(r.qty_sold),
      revenuePaise: Number(r.revenue_paise),
      totalCostPaise: r.total_cost_paise != null ? Number(r.total_cost_paise) : null,
      grossProfitPaise: r.gross_profit_paise != null ? Number(r.gross_profit_paise) : null,
      marginPct: null,
      shareOfQtyPct: 0,
      hasMissingCost: Boolean(r.has_missing_cost),
    }));
  } finally {
    client.release();
  }
}

/**
 * Full Product Sales Table (aggregated per product)
 */
export async function getProductSales(range: DateRange): Promise<ProductSaleStat[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `
      WITH sales AS (
        SELECT
          ol.product_id,
          SUM(ol.qty)::int as qty_sold,
          SUM(ol.line_taxable_paise)::bigint as revenue_paise,
          SUM(ol.line_cost_paise)::bigint as total_cost_paise,
          SUM(ol.line_gross_profit_paise)::bigint as gross_profit_paise,
          BOOL_OR(ol.unit_cost_paise IS NULL) as has_missing_cost
        FROM orders o
        JOIN order_lines ol ON o.id = ol.order_id
        WHERE o.status = 'SETTLED'
          AND o.settled_at >= $1
          AND o.settled_at <= $2
        GROUP BY ol.product_id
      ),
      totals AS (
        SELECT COALESCE(SUM(qty_sold), 0)::float as total_qty FROM sales
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        COALESCE(c.name, 'General') as category_name,
        COALESCE(s.qty_sold, 0)::int as qty_sold,
        COALESCE(s.revenue_paise, 0)::bigint as revenue_paise,
        s.total_cost_paise,
        s.gross_profit_paise,
        CASE
          WHEN s.revenue_paise > 0 AND s.gross_profit_paise IS NOT NULL
          THEN ROUND((s.gross_profit_paise::numeric / s.revenue_paise::numeric) * 100, 1)
          ELSE NULL
        END as margin_pct,
        CASE
          WHEN t.total_qty > 0 THEN ROUND((COALESCE(s.qty_sold, 0)::numeric / t.total_qty::numeric) * 100, 1)
          ELSE 0
        END as share_of_qty_pct,
        COALESCE(s.has_missing_cost, false) as has_missing_cost
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sales s ON p.id = s.product_id,
      totals t
      WHERE p.is_archived = false
      ORDER BY qty_sold DESC, revenue_paise DESC
      `,
      [range.from, range.to]
    );

    return res.rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      categoryName: r.category_name,
      qtySold: Number(r.qty_sold),
      revenuePaise: Number(r.revenue_paise),
      totalCostPaise: r.total_cost_paise != null ? Number(r.total_cost_paise) : null,
      grossProfitPaise: r.gross_profit_paise != null ? Number(r.gross_profit_paise) : null,
      marginPct: r.margin_pct != null ? parseFloat(r.margin_pct) : null,
      shareOfQtyPct: parseFloat(r.share_of_qty_pct || 0),
      hasMissingCost: Boolean(r.has_missing_cost),
    }));
  } finally {
    client.release();
  }
}

/**
 * Gross Profit per settled Order (paginated)
 */
export async function getOrderProfits(
  range: DateRange,
  limit: number = 25,
  offset: number = 0
) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `
      SELECT
        o.id,
        o.invoice_no,
        o.order_type,
        o.table_label,
        o.settled_at,
        o.subtotal_paise,
        o.taxable_paise,
        o.grand_total_paise,
        COALESCE(SUM(ol.line_cost_paise), 0)::bigint as total_cost_paise,
        COALESCE(SUM(ol.line_gross_profit_paise), 0)::bigint as gross_profit_paise,
        COUNT(CASE WHEN ol.unit_cost_paise IS NULL THEN 1 END)::int as missing_cost_lines,
        CASE
          WHEN o.taxable_paise > 0 AND SUM(ol.line_gross_profit_paise) IS NOT NULL
          THEN ROUND((SUM(ol.line_gross_profit_paise)::numeric / o.taxable_paise::numeric) * 100, 1)
          ELSE NULL
        END as margin_pct
      FROM orders o
      JOIN order_lines ol ON o.id = ol.order_id
      WHERE o.status = 'SETTLED'
        AND o.settled_at >= $1
        AND o.settled_at <= $2
      GROUP BY o.id, o.invoice_no, o.order_type, o.table_label, o.settled_at, o.subtotal_paise, o.taxable_paise, o.grand_total_paise
      ORDER BY o.settled_at DESC
      LIMIT $3 OFFSET $4
      `,
      [range.from, range.to, limit, offset]
    );

    return res.rows.map((r) => ({
      id: r.id,
      invoiceNo: r.invoice_no,
      orderType: r.order_type,
      tableLabel: r.table_label,
      settledAt: r.settled_at,
      subtotalPaise: Number(r.subtotal_paise),
      taxablePaise: Number(r.taxable_paise),
      grandTotalPaise: Number(r.grand_total_paise),
      totalCostPaise: Number(r.total_cost_paise),
      grossProfitPaise: Number(r.gross_profit_paise),
      marginPct: r.margin_pct != null ? parseFloat(r.margin_pct) : null,
      missingCostLines: Number(r.missing_cost_lines),
    }));
  } finally {
    client.release();
  }
}

/**
 * Gross Profit per Sale Line (paginated)
 */
export async function getLineProfits(
  range: DateRange,
  limit: number = 50,
  offset: number = 0
) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `
      SELECT
        ol.id,
        o.invoice_no,
        ol.product_name_snapshot,
        ol.category_name_snapshot,
        ol.qty,
        ol.unit_price_paise,
        ol.line_taxable_paise,
        ol.unit_cost_paise,
        ol.line_cost_paise,
        ol.line_gross_profit_paise,
        CASE
          WHEN ol.line_taxable_paise > 0 AND ol.line_gross_profit_paise IS NOT NULL
          THEN ROUND((ol.line_gross_profit_paise::numeric / ol.line_taxable_paise::numeric) * 100, 1)
          ELSE NULL
        END as margin_pct,
        o.settled_at
      FROM orders o
      JOIN order_lines ol ON o.id = ol.order_id
      WHERE o.status = 'SETTLED'
        AND o.settled_at >= $1
        AND o.settled_at <= $2
      ORDER BY o.settled_at DESC, ol.created_at DESC
      LIMIT $3 OFFSET $4
      `,
      [range.from, range.to, limit, offset]
    );

    return res.rows.map((r) => ({
      id: r.id,
      invoiceNo: r.invoice_no,
      productName: r.product_name_snapshot,
      categoryName: r.category_name_snapshot,
      qty: Number(r.qty),
      unitPricePaise: Number(r.unit_price_paise),
      lineTaxablePaise: Number(r.line_taxable_paise),
      unitCostPaise: r.unit_cost_paise != null ? Number(r.unit_cost_paise) : null,
      lineCostPaise: r.line_cost_paise != null ? Number(r.line_cost_paise) : null,
      lineGrossProfitPaise: r.line_gross_profit_paise != null ? Number(r.line_gross_profit_paise) : null,
      marginPct: r.margin_pct != null ? parseFloat(r.margin_pct) : null,
      settledAt: r.settled_at,
    }));
  } finally {
    client.release();
  }
}

/**
 * Hourly Distribution (0 to 23 hours in cafe timezone)
 */
export async function getHourlyHeatmap(range: DateRange) {
  const client = await pool.connect();
  const tz = range.timezone || 'Asia/Kolkata';
  try {
    const res = await client.query(
      `
      SELECT
        EXTRACT(HOUR FROM o.settled_at AT TIME ZONE $3)::int as hour,
        COUNT(DISTINCT o.id)::int as orders_count,
        COALESCE(SUM(o.taxable_paise), 0)::bigint as revenue_paise
      FROM orders o
      WHERE o.status = 'SETTLED'
        AND o.settled_at >= $1
        AND o.settled_at <= $2
      GROUP BY hour
      ORDER BY hour ASC
      `,
      [range.from, range.to, tz]
    );

    const map = new Map(res.rows.map((r) => [r.hour, r]));
    const fullHours = [];
    for (let h = 0; h < 24; h++) {
      const existing = map.get(h);
      fullHours.push({
        hour: h,
        label: `${h}:00`,
        ordersCount: existing ? Number(existing.orders_count) : 0,
        revenuePaise: existing ? Number(existing.revenue_paise) : 0,
      });
    }
    return fullHours;
  } finally {
    client.release();
  }
}

/**
 * Daily Trend within range
 */
export async function getDailyTrend(range: DateRange) {
  const client = await pool.connect();
  const tz = range.timezone || 'Asia/Kolkata';
  try {
    const res = await client.query(
      `
      SELECT
        TO_CHAR(o.settled_at AT TIME ZONE $3, 'YYYY-MM-DD') as day,
        COUNT(DISTINCT o.id)::int as orders_count,
        COALESCE(SUM(o.taxable_paise), 0)::bigint as revenue_paise,
        COALESCE(SUM(o.cgst_paise + o.sgst_paise + o.igst_or_gst_paise), 0)::bigint as tax_paise,
        COALESCE(SUM(ol.line_gross_profit_paise), 0)::bigint as gross_profit_paise
      FROM orders o
      JOIN order_lines ol ON o.id = ol.order_id
      WHERE o.status = 'SETTLED'
        AND o.settled_at >= $1
        AND o.settled_at <= $2
      GROUP BY day
      ORDER BY day ASC
      `,
      [range.from, range.to, tz]
    );

    return res.rows.map((r) => ({
      day: r.day,
      ordersCount: Number(r.orders_count),
      revenuePaise: Number(r.revenue_paise),
      taxPaise: Number(r.tax_paise),
      grossProfitPaise: Number(r.gross_profit_paise),
    }));
  } finally {
    client.release();
  }
}

/**
 * Deterministic Template Highlights (Strictly NO AI, fixed templates from SQL values)
 */
export async function getHighlights(range: DateRange): Promise<HighlightItem[]> {
  const highlights: HighlightItem[] = [];

  // 1. Best seller by quantity
  const topByQty = await getTopProducts(range, 'qty', 1);
  if (topByQty.length > 0 && topByQty[0].qtySold > 0) {
    highlights.push({
      kind: 'best_seller',
      text: `${topByQty[0].productName} was the best seller: ${topByQty[0].qtySold} sold`,
    });
  }

  // 2. Highest gross profit
  const topByProfit = await getTopProducts(range, 'profit', 1);
  if (topByProfit.length > 0 && topByProfit[0].grossProfitPaise && topByProfit[0].grossProfitPaise > 0) {
    highlights.push({
      kind: 'top_profit',
      text: `${topByProfit[0].productName} earned the most gross profit: ${formatINR(topByProfit[0].grossProfitPaise)}`,
    });
  }

  // 3. Products with zero sales
  const bottomZero = await getBottomProducts(range, 20);
  const zeroSales = bottomZero.filter((p) => p.qtySold === 0);
  if (zeroSales.length > 0) {
    const names = zeroSales.slice(0, 3).map((p) => p.productName).join(', ');
    const extra = zeroSales.length > 3 ? ` and ${zeroSales.length - 3} others` : '';
    highlights.push({
      kind: 'zero_sales',
      text: `${zeroSales.length} product${zeroSales.length > 1 ? 's' : ''} had no sales: ${names}${extra}`,
    });
  }

  // 4. Busiest hour
  const hourly = await getHourlyHeatmap(range);
  const busiest = [...hourly].sort((a, b) => b.ordersCount - a.ordersCount)[0];
  if (busiest && busiest.ordersCount > 0) {
    highlights.push({
      kind: 'busiest_hour',
      text: `Busiest hour was ${busiest.hour}:00 to ${busiest.hour + 1}:00 with ${busiest.ordersCount} orders`,
    });
  }

  // 5. Missing cost price warning
  const kpis = await getKpis(range);
  if (kpis.linesWithMissingCostCount > 0) {
    highlights.push({
      kind: 'missing_cost',
      text: `${kpis.linesWithMissingCostCount} item line${kpis.linesWithMissingCostCount > 1 ? 's' : ''} sold have no cost price, so their profit isn't counted`,
    });
  }

  return highlights.slice(0, 6);
}
