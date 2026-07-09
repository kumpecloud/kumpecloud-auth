create table domains (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  domain varchar(256) not null,
  status varchar(32) /* @use DomainStatus */ not null default('PendingVerification'),
  error_message varchar(1024),
  dns_records JSON /* @use DomainDnsRecords */ not null default '[]',
  cloudflare_data JSON /* @use CloudflareData */,
  updated_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id),
  constraint domains__domain
    unique (tenant_id, domain)
);

create index domains__id on domains (tenant_id, id);
