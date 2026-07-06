-- Order totals: subtotal + tax + shipping - discounts must equal the persisted total.
select
  o.id as order_id,
  o.subtotal,
  o.tax_total,
  o.shipping_total,
  o.discount_total,
  o.total,
  (o.subtotal + o.tax_total + o.shipping_total - coalesce(o.discount_total, 0)) as expected_total
from orders o
where o.total <> (o.subtotal + o.tax_total + o.shipping_total - coalesce(o.discount_total, 0));
