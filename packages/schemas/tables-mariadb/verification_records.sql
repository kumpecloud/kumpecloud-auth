create table verification_records (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  user_id varchar(21)
    references users (id) on update cascade on delete cascade,
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) not null,
  /** Use JsonObject here to avoid complex typing, the type will be validated in verification classes. */
  data JSON /* @use JsonObject */ not null default '{}',
  primary key (id)
);

create index verification_records__id
  on verification_records (tenant_id, id);
