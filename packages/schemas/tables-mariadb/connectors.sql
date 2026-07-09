/* init_order = 1 */

create table connectors (
  tenant_id varchar(21) not null 
    references tenants (id) on update cascade on delete cascade,
  id varchar(128) not null,
  sync_profile boolean not null default FALSE,
  /** Whether the token storage is enabled for this connector. Only applied for OAuth2/OIDC social connectors. */
  enable_token_storage boolean not null default FALSE,
  connector_id varchar(128) not null,
  config JSON /* @use JsonObject */ not null default '{}',
  metadata JSON /* @use ConfigurableConnectorMetadata */ not null default '{}',
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id)
);

create index connectors__id
  on connectors (tenant_id, id);
