create table service_logs (
  id varchar(21) not null,
  tenant_id varchar(21) not null,
  type varchar(64) not null,
  payload JSON /* @use JsonObject */ not null default '{}',
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id)
);

create index service_logs__id
  on service_logs (id);

create index service_logs__tenant_id__type
  on service_logs (tenant_id, type);

/* no_after_each */
