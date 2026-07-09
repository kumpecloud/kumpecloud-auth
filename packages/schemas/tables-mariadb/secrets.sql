/* init_order = 2 */
create table secrets (
  tenant_id varchar(21) not null 
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null primary key,
  user_id varchar(21) not null 
    references users (id) on update cascade on delete cascade,
  type varchar(256) /* @use SecretType */ not null,
  /** Encrypted data encryption key (DEK) for the secret. */
  encrypted_dek bytea /* @use BufferLike */ not null,
  /** Initialization vector for the secret encryption. */
  iv bytea /* @use BufferLike */ not null,
  /** Authentication tag for the secret encryption. */
  auth_tag bytea /* @use BufferLike */ not null,
  /** The encrypted secret data. e.g. { access_token, refresh_token } */
  ciphertext bytea /* @use BufferLike */ not null,
  /** The metadata associated with the secret. */
  metadata JSON /* @use JsonObject */ not null default '{}',
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON secrets FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP(3);
