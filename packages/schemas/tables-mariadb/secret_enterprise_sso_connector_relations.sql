/* init_order = 3 */

create table secret_enterprise_sso_connector_relations (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  secret_id varchar(21) not null
    references secrets (id) on update cascade on delete cascade,
  /** SSO connector ID foreign reference. Only present for secrets that store SSO connector tokens. Note: avoid directly cascading deletes here, need to delete the secrets first.*/
  sso_connector_id varchar(128) not null
    references sso_connectors (id) on update cascade,
  /** User SSO connector issuer. Only present for secrets that store SSO connector tokens. */
  issuer varchar(256) not null,
  /** User SSO identity ID. Only present for secrets that store SSO identity tokens. */
  identity_id varchar(128) not null,
  primary key (tenant_id, secret_id),
  /** Ensures that each SSO identity is associated with only one secret. */
  foreign key (tenant_id, issuer, identity_id)
    references user_sso_identities (tenant_id, issuer, identity_id) on update cascade
);

CREATE TRIGGER delete_secrets_before_sso_connector_delete
BEFORE DELETE ON sso_connectors
FOR EACH ROW
BEGIN
  DELETE FROM secrets
  WHERE id IN (
    SELECT secret_id FROM secret_enterprise_sso_connector_relations
    WHERE tenant_id = OLD.tenant_id AND sso_connector_id = OLD.id
  );
END;

CREATE TRIGGER delete_secret_before_sso_identity_delete
BEFORE DELETE ON user_sso_identities
FOR EACH ROW
BEGIN
  DELETE FROM secrets
  WHERE id IN (
    SELECT secret_id FROM secret_enterprise_sso_connector_relations
    WHERE tenant_id = OLD.tenant_id
      AND issuer = OLD.issuer
      AND identity_id = OLD.identity_id
  )
  AND user_id = OLD.user_id;
END;
