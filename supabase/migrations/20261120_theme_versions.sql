-- 三本主題書（原生家庭／財富／天職）上線前要先跑這一段。
-- 只是放寬允許值，不動任何既有資料；可重複執行。

-- 1) reports.version：加入三個主題版本，後台才能儲存主題書
alter table public.reports drop constraint if exists reports_version_check;
alter table public.reports add constraint reports_version_check
  check (version = any (array['script','breakthrough','sync','clash','family','wealth','vocation']));

-- 2) orders.product：加入三個主題商品，之後接上購買流程時使用
alter table public.orders drop constraint if exists orders_product_check;
alter table public.orders add constraint orders_product_check
  check (product = any (array['solo','couple','family','wealth','vocation']));
