import pg from 'pg';

const { Pool } = pg;

export type OrderLineItem = {
  title: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type OrderTotals = {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
};

export function priceToCents(value: string | number): number {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }

  const normalized = value.replace(/[^0-9.-]/g, '');
  return Math.round(Number.parseFloat(normalized) * 100);
}

export class DbClient {
  private readonly pool?: pg.Pool;

  constructor(connectionString = process.env.DATABASE_URL) {
    if (connectionString) {
      this.pool = new Pool({ connectionString });
    }
  }

  async getLatestOrderIdByEmail(email: string): Promise<string | null> {
    const row = await this.one<{ id: string }>(
      `
      select o.id
      from orders o
      left join customers c on c.id = o.customer_id
      where lower(coalesce(o.email, c.email)) = lower($1)
      order by o.created_at desc
      limit 1
      `,
      [email],
    );
    return row?.id ?? null;
  }

  async getOrderLineItems(orderId: string): Promise<OrderLineItem[]> {
    const rows = await this.many<{
      title: string;
      quantity: number;
      unit_price: number;
      total: number;
    }>(
      `
      select
        title,
        quantity,
        unit_price,
        unit_price * quantity as total
      from line_items
      where order_id = $1
      order by created_at asc
      `,
      [orderId],
    );

    return rows.map((row) => ({
      title: row.title,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      total: Number(row.total),
    }));
  }

  async getOrderTotals(orderId: string): Promise<OrderTotals | null> {
    const row = await this.one<{
      subtotal: number;
      tax_total: number;
      shipping_total: number;
      total: number;
    }>(
      `
      select subtotal, tax_total, shipping_total, total
      from orders
      where id = $1
      `,
      [orderId],
    );

    return row
      ? {
          subtotal: Number(row.subtotal),
          tax: Number(row.tax_total),
          shipping: Number(row.shipping_total),
          total: Number(row.total),
        }
      : null;
  }

  async dispose(): Promise<void> {
    await this.pool?.end();
  }

  private async one<T>(sql: string, params: unknown[]): Promise<T | null> {
    const rows = await this.many<T>(sql, params);
    return rows[0] ?? null;
  }

  private async many<T>(sql: string, params: unknown[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('DATABASE_URL is required for database-backed assertions.');
    }
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }
}
