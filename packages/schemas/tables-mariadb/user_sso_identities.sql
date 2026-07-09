/* init_order = 2 */

create table user_sso_identities (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  user_id varchar(12) not null references users (id) on update cascade on delete cascade,
  /** Unique provider identifier. Issuer of the OIDC connectors, entityId of the SAML providers */
  issuer varchar(256) not null,
  /** Provider user identity id*/
  identity_id varchar(128) not null,
  detail JSON /* @use JsonObject */ not null default '{}',
  /** Known issue: created_at uses timestamp instead of DATETIME(3) */
  created_at timestamp not null DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  sso_connector_id
    varchar(128) not null
    references sso_connectors (id) on update cascade on delete cascade,
  primary key (id),
  constraint user_sso_identities__issuer__identity_id
    unique (tenant_id, issuer, identity_id)
);


CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_sso_identities FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP(3);
