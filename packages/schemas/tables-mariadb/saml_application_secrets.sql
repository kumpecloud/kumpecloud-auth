/* init_order = 2 */

create table saml_application_secrets (
  id varchar(21) not null,
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  application_id varchar(21) not null
    references applications (id) on update cascade on delete cascade,
  private_key text not null,
  certificate text not null,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) not null,
  active boolean not null,
  active_application_id varchar(43) as (if(active, concat(tenant_id, ':', application_id), null)) virtual,
  primary key (tenant_id, application_id, id)
);

-- Only one active secret per application
create unique index saml_application_secrets__unique_active_secret
  on saml_application_secrets (active_application_id);
