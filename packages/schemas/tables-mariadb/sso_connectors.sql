/* init_order = 1 */
create table sso_connectors (
  tenant_id varchar(21) not null 
    references tenants (id) on update cascade on delete cascade,
  /** The globally unique identifier of the SSO connector. */
  id varchar(128) not null,
  /** The identifier of connector's SSO provider */
  provider_name varchar(128) not null,
  /** The name of the SSO provider for display. */
  connector_name varchar(128) not null,
  /** The connector configuration. Different schemas for different provide type */
  config JSON /* @use JsonObject */ not null default '{}',
  /** The SSO email domains. */
  domains JSON /* @use SsoDomains */ not null default '[]',
  /** The SSO branding. */
  branding JSON /* @use SsoBranding */ not null default '{}',
  /** Determines whether to synchronize the user's profile on each login. */
  sync_profile boolean not null default FALSE,
  /** Whether the token storage is enabled for this connector. Only applied for OAuth2/OIDC SSO connectors. */
  enable_token_storage boolean not null default FALSE,
  /** When the SSO connector was created. */
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id),
  constraint sso_connectors__connector_name__unique
    unique (tenant_id, connector_name)
);

create index sso_connectors__id
  on sso_connectors (tenant_id, id);

create index sso_connectors__id__provider_name
  on sso_connectors (tenant_id, id, provider_name);
