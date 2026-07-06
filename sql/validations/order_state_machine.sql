-- Order state-machine consistency: captured orders must have an authorized payment.
select
  o.id as order_id,
  o.status,
  o.payment_status
from orders o
left join payments p on p.order_id = o.id and p.status in ('authorized', 'captured')
where o.payment_status = 'captured'
  and p.id is null;
