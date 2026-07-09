/* init_order = 3 */

create table secret_social_connector_relations (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  secret_id varchar(21) not null
    references secrets (id) on update cascade on delete cascade,
  /** Social connector ID foreign reference. Only present for secrets that store social connector tokens. Note: avoid directly cascading deletes here, need to delete the secrets first.*/
  connector_id varchar(128) not null
    references connectors (id) on update cascade,
  /** The target of the social connector. e.g. 'github', 'google', etc. */
  target varchar(256) not null,
  /** User social identity ID foreign reference. Only present for secrets that store social identity tokens. */
  identity_id varchar(128) not null,
  primary key (tenant_id, secret_id),
  /** Ensures that each social identity is associated with only one secret. */
  constraint secret_social_connector_relations__target__identity_id
    unique (tenant_id, target, identity_id)
);

CREATE TRIGGER delete_secrets_before_social_connector_delete
BEFORE DELETE ON connectors
FOR EACH ROW
BEGIN
  DELETE FROM secrets
  WHERE id IN (
    SELECT secret_id FROM secret_social_connector_relations
    WHERE tenant_id = OLD.tenant_id AND connector_id = OLD.id
  );
END;

CREATE TRIGGER delete_secrets_before_social_identity_delete
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE key_count INT DEFAULT 0;
  DECLARE identity_target VARCHAR(256);
  DECLARE old_user_id VARCHAR(128);
  DECLARE new_user_id VARCHAR(128);

  IF NOT (OLD.identities <=> NEW.identities) THEN
    SET key_count = COALESCE(JSON_LENGTH(JSON_KEYS(OLD.identities)), 0);

    WHILE i < key_count DO
      SET identity_target = JSON_UNQUOTE(JSON_EXTRACT(JSON_KEYS(OLD.identities), CONCAT('$[', i, ']')));
      SET old_user_id = JSON_UNQUOTE(JSON_EXTRACT(OLD.identities, CONCAT('$.', identity_target, '.userId')));
      SET new_user_id = JSON_UNQUOTE(JSON_EXTRACT(NEW.identities, CONCAT('$.', identity_target, '.userId')));

      IF new_user_id IS NULL OR new_user_id <> old_user_id THEN
        DELETE secrets FROM secrets
        INNER JOIN secret_social_connector_relations
          ON secrets.id = secret_social_connector_relations.secret_id
        WHERE secret_social_connector_relations.target = identity_target
          AND secret_social_connector_relations.identity_id = old_user_id
          AND secrets.user_id = OLD.id;
      END IF;

      SET i = i + 1;
    END WHILE;
  END IF;
END;
