-- Catalog referential integrity: every order line must reference an active product variant.
select
  li.order_id,
  li.id as line_item_id,
  li.variant_id,
  li.title
from line_items li
left join product_variants pv on pv.id = li.variant_id
left join products p on p.id = pv.product_id
where pv.id is null
   or coalesce(p.status, 'published') not in ('published', 'active');
