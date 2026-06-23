-- Medicines master list
create table medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text unique,
  pharma_company text,
  category text,
  unit text default 'box',
  threshold integer default 10,
  created_at timestamptz default now()
);

-- Inventory (current stock per medicine)
create table inventory (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid references medicines(id) on delete cascade,
  quantity_current integer default 0,
  expiry_date date,
  batch_number text,
  last_updated timestamptz default now()
);

-- Demand list (medicines flagged as low)
create table demand_list (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid references medicines(id) on delete cascade,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Bills (rep deliveries)
create table bills (
  id uuid primary key default gen_random_uuid(),
  pharma_company text,
  rep_name text,
  bill_date date default current_date,
  bill_image_url text,
  created_at timestamptz default now()
);

-- Bill items (medicines in each bill)
create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id) on delete cascade,
  medicine_id uuid references medicines(id) on delete cascade,
  quantity_received integer not null,
  expiry_date date,
  batch_number text,
  price numeric(10,2)
);

-- RLS open for testing (no auth yet)
alter table medicines enable row level security;
alter table inventory enable row level security;
alter table demand_list enable row level security;
alter table bills enable row level security;
alter table bill_items enable row level security;

create policy "allow all" on medicines for all using (true);
create policy "allow all" on inventory for all using (true);
create policy "allow all" on demand_list for all using (true);
create policy "allow all" on bills for all using (true);
create policy "allow all" on bill_items for all using (true);
