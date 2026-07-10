create table logto_configs (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  `key` varchar(256) not null,
  `value` JSON /* @use Json */ not null default '{}',
  primary key (tenant_id, `key`)
);
