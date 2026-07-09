create table captcha_providers (
  tenant_id varchar(21) not null 
    references tenants (id) on update cascade on delete cascade,
  id varchar(128) not null,
  config JSON /* @use CaptchaConfig */ not null default '{}',
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id),
  unique (tenant_id)
);

create index captcha_providers__id
  on captcha_providers (tenant_id, id);
