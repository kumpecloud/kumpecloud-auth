create table hooks (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  name varchar(256) not null default '',
  event varchar(128) /* @use HookEvent */,
  events JSON /* @use HookEvents */ not null default '[]',
  config JSON /* @use HookConfig */ not null,
  signing_key varchar(64) not null default '',
  enabled boolean not null default true,
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id)
);

create index hooks__id on hooks (tenant_id, id);
