create table daily_active_users (
  id varchar(21) not null,
  tenant_id varchar(21) not null,
  user_id varchar(21) not null,
  `date` DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id),
  constraint daily_active_users__user_id_date
    unique (user_id, `date`)
);

-- Optimized index for aggregation queries with better write performance
create index daily_active_users__tenant_date_user
  on daily_active_users (tenant_id, `date`, user_id);

create index daily_active_users__date
  on daily_active_users (tenant_id, `date`);
