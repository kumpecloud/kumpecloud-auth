/* init_order = 2 */

create table oidc_session_extensions (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  session_uid varchar(128) not null,
  account_id varchar(12) not null
    references users (id) on update cascade on delete cascade,
  last_submission JSON /* @use JsonObject */ not null default '{}',
  client_id varchar(21) null,
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (tenant_id, session_uid)
);

CREATE TRIGGER oidc_session_extensions_set_updated_at BEFORE UPDATE ON oidc_session_extensions FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP(3);
