/* init_order = 1 */

create table applications (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  name varchar(256) not null,
  /** @deprecated The internal client secret. Note it is only used for internal validation, and the actual secret should be stored in the `application_secrets` table. You should NOT use it unless you are sure what you are doing. */
  secret varchar(64) not null,
  description text,
  type varchar(16) not null,
  oidc_client_metadata JSON /* @use OidcClientMetadata */ not null,
  custom_client_metadata JSON /* @use CustomClientMetadata */ not null default ('{}'),
  protected_app_metadata JSON /* @use ProtectedAppMetadata */,
  custom_data JSON /* @use JsonObject */ not null default ('{}'),
  is_third_party boolean not null default false,
  app_level_access_control_enabled boolean not null default false,
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id)
);

create index applications__id
  on applications (tenant_id, id);

create index applications__is_third_party
  on applications (tenant_id, is_third_party);

create index applications__type
  on applications (tenant_id, type);

create unique index applications__protected_app_metadata_host
  on applications ((cast(json_unquote(json_extract(protected_app_metadata, '$.host')) as char(255))));

create unique index applications__protected_app_metadata_custom_domain
  on applications ((cast(json_unquote(json_extract(protected_app_metadata, '$.customDomains[0].domain')) as char(255))));
