import {
  pgTable,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Users ---
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull().unique(), // case-insensitive handled in queries
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  roles: text('roles').array().notNull().default(['WAITER']),
  adminPinHash: text('admin_pin_hash'),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Passkeys ---
export const passkeys = pgTable('passkeys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(), // base64url encoded
  publicKey: text('public_key').notNull(), // base64url encoded
  signCount: bigint('sign_count', { mode: 'number' }).notNull().default(0),
  transports: text('transports').array(),
  deviceLabel: text('device_label').notNull().default('My Authenticator'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});

// --- Sessions ---
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // SHA-256 hashed session token
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    elevatedUntil: timestamp('elevated_until', { withTimezone: true }),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  })
);

// --- Auth Attempts (Rate Limiting) ---
export const authAttempts = pgTable(
  'auth_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(), // username / ip / user_id:pin
    kind: text('kind').notNull(), // 'password' | 'pin' | 'passkey'
    success: boolean('success').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    keyCreatedIdx: index('auth_attempts_key_created_idx').on(table.key, table.createdAt),
  })
);

// --- Categories ---
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Products ---
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    description: text('description'),
    dietTag: text('diet_tag'), // 'VEG' | 'NON_VEG' | 'VEGAN'
    pricePaise: bigint('price_paise', { mode: 'number' }).notNull(),
    costPaise: bigint('cost_paise', { mode: 'number' }),
    taxRateBpsOverride: integer('tax_rate_bps_override'),
    imageUrl: text('image_url'),
    isAvailable: boolean('is_available').notNull().default(true),
    isArchived: boolean('is_archived').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    categorySortIdx: index('products_category_sort_idx').on(table.categoryId, table.sortOrder),
  })
);

// --- Price History ---
export const priceHistory = pgTable('price_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  field: text('field').notNull(), // 'price' | 'cost'
  oldPaise: bigint('old_paise', { mode: 'number' }),
  newPaise: bigint('new_paise', { mode: 'number' }),
  changedBy: uuid('changed_by')
    .notNull()
    .references(() => users.id),
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Settings ---
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1), // Single row table
  cafeName: text('cafe_name').notNull().default('My Cafe'),
  address: text('address'),
  phone: text('phone'),
  gstin: text('gstin'),
  fssai: text('fssai'),
  logoUrl: text('logo_url'),
  receiptFooter: text('receipt_footer').default('Thank you for visiting!'),
  invoicePrefix: text('invoice_prefix').notNull().default('ORD'),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  taxMode: text('tax_mode').notNull().default('GST_INTRA'), // 'GST_INTRA'|'GST_SINGLE_LINE'|'NONE'|'COMPOSITION'
  taxRateBps: integer('tax_rate_bps').notNull().default(500),
  pricesIncludeTax: boolean('prices_include_tax').notNull().default(false),
  serviceChargeEnabled: boolean('service_charge_enabled').notNull().default(false),
  serviceChargeBps: integer('service_charge_bps').notNull().default(500),
  roundGrandTotal: boolean('round_grand_total').notNull().default(true),
  elevationMinutes: integer('elevation_minutes').notNull().default(10),
  sessionIdleHours: integer('session_idle_hours').notNull().default(12),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Orders ---
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    status: text('status').notNull().default('OPEN'), // 'OPEN' | 'SETTLED' | 'VOID'
    orderType: text('order_type').notNull().default('DINE_IN'), // 'DINE_IN' | 'TAKEAWAY'
    tableLabel: text('table_label'),
    note: text('note'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    settledBy: uuid('settled_by').references(() => users.id),
    voidedBy: uuid('voided_by').references(() => users.id),
    voidReason: text('void_reason'),
    paymentMode: text('payment_mode'), // 'CASH' | 'UPI' | 'CARD' | 'OTHER'
    invoiceNo: text('invoice_no'),
    financialYear: text('financial_year'),
    // Snapshot totals
    subtotalPaise: bigint('subtotal_paise', { mode: 'number' }).notNull().default(0),
    serviceChargePaise: bigint('service_charge_paise', { mode: 'number' }).notNull().default(0),
    taxablePaise: bigint('taxable_paise', { mode: 'number' }).notNull().default(0),
    cgstPaise: bigint('cgst_paise', { mode: 'number' }).notNull().default(0),
    sgstPaise: bigint('sgst_paise', { mode: 'number' }).notNull().default(0),
    igstOrGstPaise: bigint('igst_or_gst_paise', { mode: 'number' }).notNull().default(0),
    roundOffPaise: bigint('round_off_paise', { mode: 'number' }).notNull().default(0),
    grandTotalPaise: bigint('grand_total_paise', { mode: 'number' }).notNull().default(0),
    // Snapshot tax config
    taxMode: text('tax_mode').notNull().default('GST_INTRA'),
    taxRateBps: integer('tax_rate_bps').notNull().default(500),
    pricesIncludeTax: boolean('prices_include_tax').notNull().default(false),
    serviceChargeBps: integer('service_charge_bps').notNull().default(0),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
  },
  (table) => ({
    statusSettledIdx: index('orders_status_settled_idx').on(table.status, table.settledAt),
    invoiceNoIdx: uniqueIndex('orders_invoice_no_idx').on(table.invoiceNo),
    createdByIdx: index('orders_created_by_idx').on(table.createdBy),
  })
);

// --- Order Lines ---
export const orderLines = pgTable(
  'order_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    productNameSnapshot: text('product_name_snapshot').notNull(),
    categoryNameSnapshot: text('category_name_snapshot').notNull().default('General'),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull(),
    unitCostPaise: bigint('unit_cost_paise', { mode: 'number' }),
    taxRateBps: integer('tax_rate_bps').notNull(),
    qty: integer('qty').notNull(),
    note: text('note'),
    lineAmountPaise: bigint('line_amount_paise', { mode: 'number' }).notNull(),
    lineTaxablePaise: bigint('line_taxable_paise', { mode: 'number' }).notNull(),
    lineTaxPaise: bigint('line_tax_paise', { mode: 'number' }).notNull(),
    lineCostPaise: bigint('line_cost_paise', { mode: 'number' }),
    lineGrossProfitPaise: bigint('line_gross_profit_paise', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index('order_lines_order_id_idx').on(table.orderId),
    productIdIdx: index('order_lines_product_id_idx').on(table.productId),
  })
);

// --- Invoice Counters ---
export const invoiceCounters = pgTable('invoice_counters', {
  financialYear: text('financial_year').primaryKey(), // e.g. '26-27'
  lastNumber: bigint('last_number', { mode: 'number' }).notNull().default(0),
});

// --- Audit Log ---
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  passkeys: many(passkeys),
  ordersCreated: many(orders, { relationName: 'createdBy' }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  creator: one(users, {
    fields: [orders.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  settler: one(users, {
    fields: [orders.settledBy],
    references: [users.id],
    relationName: 'settledBy',
  }),
  lines: many(orderLines),
}));

export const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order: one(orders, {
    fields: [orderLines.orderId],
    references: [orders.id],
  }),
}));
