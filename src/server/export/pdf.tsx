import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import { paiseToRupees } from '@/src/domain/money';

const a4Styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#4B5563',
    marginBottom: 2,
  },
  invoiceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  watermark: {
    fontSize: 28,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#9CA3AF',
    paddingBottom: 6,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    paddingTop: 6,
    paddingBottom: 6,
  },
  colDesc: { width: '45%' },
  colQty: { width: '12%', textAlign: 'center' },
  colRate: { width: '20%', textAlign: 'right' },
  colTotal: { width: '23%', textAlign: 'right' },
  totalsBlock: {
    alignSelf: 'flex-end',
    width: '45%',
    marginTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 3,
    paddingBottom: 3,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: '#111827',
    paddingTop: 6,
    marginTop: 6,
    fontWeight: 'bold',
    fontSize: 13,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 9,
    color: '#6B7280',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
});

const receiptStyles = StyleSheet.create({
  page: {
    width: 226, // 80mm ~ 226 pt
    padding: 12,
    fontSize: 8.5,
    fontFamily: 'Courier',
    color: '#000000',
  },
  header: {
    textAlign: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomStyle: 'dashed',
    borderBottomColor: '#000000',
    paddingBottom: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  meta: {
    marginBottom: 6,
    fontSize: 7.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomStyle: 'dashed',
    borderBottomColor: '#000000',
    marginTop: 4,
    marginBottom: 4,
  },
  grandTotal: {
    fontSize: 11,
    fontWeight: 'bold',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footer: {
    textAlign: 'center',
    fontSize: 7.5,
    marginTop: 10,
  },
});

export async function generateOrderPdf(
  order: any,
  lines: any[],
  cafeSettings: any,
  layout: 'a4' | 'receipt' = 'a4'
): Promise<Buffer> {
  const isSettled = order.status === 'SETTLED';
  const isComposition = order.taxMode === 'COMPOSITION';
  const isZeroTax = order.taxMode === 'NONE' || order.taxRateBps === 0;

  const docTitle = isComposition
    ? 'BILL OF SUPPLY'
    : isZeroTax
    ? 'BILL'
    : 'TAX INVOICE';

  const dateStr = new Date(order.settledAt || order.createdAt).toLocaleString('en-IN', {
    timeZone: cafeSettings?.timezone || 'Asia/Kolkata',
  });

  if (layout === 'receipt') {
    // 80mm Receipt
    const receiptDoc = (
      <Document>
        <Page size={[226, 600]} style={receiptStyles.page}>
          <View style={receiptStyles.header}>
            <Text style={receiptStyles.title}>{cafeSettings?.cafeName || 'XPRSO CAFE'}</Text>
            {cafeSettings?.address ? <Text>{cafeSettings.address}</Text> : null}
            {cafeSettings?.gstin ? <Text>GSTIN: {cafeSettings.gstin}</Text> : null}
            {cafeSettings?.phone ? <Text>Tel: {cafeSettings.phone}</Text> : null}
            <Text style={{ marginTop: 2, fontWeight: 'bold' }}>{docTitle}</Text>
          </View>

          {!isSettled && (
            <Text style={{ color: 'red', textAlign: 'center', fontWeight: 'bold', marginBottom: 4 }}>
              * PROVISIONAL — NOT AN INVOICE *
            </Text>
          )}

          <View style={receiptStyles.meta}>
            <Text>Invoice: {order.invoiceNo || 'DRAFT'}</Text>
            <Text>Date: {dateStr}</Text>
            <Text>Type: {order.orderType === 'DINE_IN' ? `Table ${order.tableLabel || ''}` : 'Takeaway'}</Text>
            {order.paymentMode ? <Text>Mode: {order.paymentMode}</Text> : null}
          </View>

          <View style={receiptStyles.separator} />

          {/* Items */}
          {lines.map((l, idx) => (
            <View key={idx} style={receiptStyles.row}>
              <Text style={{ maxWidth: 140 }}>
                {l.qty}x {l.productNameSnapshot}
              </Text>
              <Text>INR {paiseToRupees(l.lineAmountPaise).toFixed(2)}</Text>
            </View>
          ))}

          <View style={receiptStyles.separator} />

          {/* Totals */}
          <View style={receiptStyles.row}>
            <Text>Subtotal:</Text>
            <Text>INR {paiseToRupees(order.subtotalPaise).toFixed(2)}</Text>
          </View>

          {order.serviceChargePaise > 0 && (
            <View style={receiptStyles.row}>
              <Text>Service Charge:</Text>
              <Text>INR {paiseToRupees(order.serviceChargePaise).toFixed(2)}</Text>
            </View>
          )}

          {order.cgstPaise > 0 && (
            <>
              <View style={receiptStyles.row}>
                <Text>CGST ({((order.taxRateBps || 500) / 200).toFixed(1)}%):</Text>
                <Text>INR {paiseToRupees(order.cgstPaise).toFixed(2)}</Text>
              </View>
              <View style={receiptStyles.row}>
                <Text>SGST ({((order.taxRateBps || 500) / 200).toFixed(1)}%):</Text>
                <Text>INR {paiseToRupees(order.sgstPaise).toFixed(2)}</Text>
              </View>
            </>
          )}

          {order.roundOffPaise !== 0 && (
            <View style={receiptStyles.row}>
              <Text>Round off:</Text>
              <Text>
                {order.roundOffPaise > 0 ? '+' : ''}
                {paiseToRupees(order.roundOffPaise).toFixed(2)}
              </Text>
            </View>
          )}

          <View style={receiptStyles.separator} />

          <View style={receiptStyles.grandTotal}>
            <Text>TOTAL:</Text>
            <Text>INR {paiseToRupees(order.grandTotalPaise).toFixed(2)}</Text>
          </View>

          <View style={receiptStyles.footer}>
            <Text>{cafeSettings?.receiptFooter || 'Thank you for your visit!'}</Text>
          </View>
        </Page>
      </Document>
    );

    const streamOrBuffer = await pdf(receiptDoc).toBuffer();
    if (Buffer.isBuffer(streamOrBuffer)) return streamOrBuffer;
    const chunks: Uint8Array[] = [];
    for await (const chunk of streamOrBuffer as any) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }

  // A4 Tax Invoice
  const a4Doc = (
    <Document>
      <Page size="A4" style={a4Styles.page}>
        {!isSettled && (
          <Text style={a4Styles.watermark}>PROVISIONAL — NOT AN INVOICE</Text>
        )}

        {/* Header */}
        <View style={a4Styles.header}>
          <Text style={a4Styles.title}>{cafeSettings?.cafeName || 'XPRSO CAFÉ'}</Text>
          {cafeSettings?.address ? <Text style={a4Styles.subtitle}>{cafeSettings.address}</Text> : null}
          {cafeSettings?.gstin ? (
            <Text style={a4Styles.subtitle}>
              GSTIN: {cafeSettings.gstin} | SAC: 9963 (Restaurant & Catering Services)
            </Text>
          ) : null}
          {cafeSettings?.fssai ? <Text style={a4Styles.subtitle}>FSSAI Lic: {cafeSettings.fssai}</Text> : null}
          {cafeSettings?.phone ? <Text style={a4Styles.subtitle}>Phone: {cafeSettings.phone}</Text> : null}
        </View>

        {/* Metadata */}
        <View style={a4Styles.invoiceMeta}>
          <View>
            <Text style={{ fontWeight: 'bold', fontSize: 12 }}>{docTitle}</Text>
            <Text>Invoice #: {order.invoiceNo || 'DRAFT'}</Text>
            <Text>Date: {dateStr}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text>Type: {order.orderType === 'DINE_IN' ? `Dine-in (Table ${order.tableLabel || ''})` : 'Takeaway'}</Text>
            <Text>Payment: {order.paymentMode || 'PENDING'}</Text>
          </View>
        </View>

        {isComposition && (
          <Text style={{ fontSize: 9, fontStyle: 'italic', marginBottom: 12, color: '#B45309' }}>
            Composition taxable person, not eligible to collect tax on supplies.
          </Text>
        )}

        {/* Line Items Table */}
        <View style={a4Styles.table}>
          <View style={a4Styles.tableHeader}>
            <Text style={a4Styles.colDesc}>Item Description</Text>
            <Text style={a4Styles.colQty}>Qty</Text>
            <Text style={a4Styles.colRate}>Unit Price (INR)</Text>
            <Text style={a4Styles.colTotal}>Total (INR)</Text>
          </View>

          {lines.map((l, idx) => (
            <View key={idx} style={a4Styles.tableRow}>
              <View style={a4Styles.colDesc}>
                <Text style={{ fontWeight: 'bold' }}>{l.productNameSnapshot}</Text>
                {l.note ? <Text style={{ fontSize: 8, color: '#6B7280' }}>Note: {l.note}</Text> : null}
              </View>
              <Text style={a4Styles.colQty}>{l.qty}</Text>
              <Text style={a4Styles.colRate}>{paiseToRupees(l.unitPricePaise).toFixed(2)}</Text>
              <Text style={a4Styles.colTotal}>{paiseToRupees(l.lineAmountPaise).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Totals Block */}
        <View style={a4Styles.totalsBlock}>
          <View style={a4Styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>INR {paiseToRupees(order.subtotalPaise).toFixed(2)}</Text>
          </View>

          {order.serviceChargePaise > 0 && (
            <View style={a4Styles.totalRow}>
              <Text>Service Charge:</Text>
              <Text>INR {paiseToRupees(order.serviceChargePaise).toFixed(2)}</Text>
            </View>
          )}

          {order.cgstPaise > 0 && (
            <>
              <View style={a4Styles.totalRow}>
                <Text>CGST ({((order.taxRateBps || 500) / 200).toFixed(1)}%):</Text>
                <Text>INR {paiseToRupees(order.cgstPaise).toFixed(2)}</Text>
              </View>
              <View style={a4Styles.totalRow}>
                <Text>SGST ({((order.taxRateBps || 500) / 200).toFixed(1)}%):</Text>
                <Text>INR {paiseToRupees(order.sgstPaise).toFixed(2)}</Text>
              </View>
            </>
          )}

          {order.roundOffPaise !== 0 && (
            <View style={a4Styles.totalRow}>
              <Text>Round off:</Text>
              <Text>
                {order.roundOffPaise > 0 ? '+' : ''}
                {paiseToRupees(order.roundOffPaise).toFixed(2)}
              </Text>
            </View>
          )}

          <View style={a4Styles.grandTotalRow}>
            <Text>Grand Total:</Text>
            <Text>INR {paiseToRupees(order.grandTotalPaise).toFixed(2)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={a4Styles.footer}>
          <Text>{cafeSettings?.receiptFooter || 'Thank you for dining with us!'}</Text>
        </View>
      </Page>
    </Document>
  );

  const a4StreamOrBuffer = await pdf(a4Doc).toBuffer();
  if (Buffer.isBuffer(a4StreamOrBuffer)) return a4StreamOrBuffer;
  const chunks: Uint8Array[] = [];
  for await (const chunk of a4StreamOrBuffer as any) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
