-- Pricing consistency: order line totals must reconcile to unit price * quantity.
select
  li.order_id,
  li.id as line_item_id,
  li.title,
  li.quantity,
  li.unit_price,
  li.total
from line_items li
where li.total <> li.unit_price * li.quantity;
