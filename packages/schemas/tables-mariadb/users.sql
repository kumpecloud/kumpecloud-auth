/* init_order = 1 */

create table users (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(12) not null,
  username varchar(128),
  primary_email varchar(128),
  primary_phone varchar(128),
  password_encrypted varchar(256),
  password_encryption_method varchar(16),
  name varchar(128),
  /** The URL that points to the user's profile picture. Mapped to OpenID Connect's `picture` claim. */ 
  avatar varchar(2048),
  /** Additional OpenID Connect standard claims that are not included in user's properties. */
  profile JSON /* @use UserProfile */ not null default '{}',
  application_id varchar(21),
  identities JSON /* @use Identities */ not null default '{}',
  custom_data JSON /* @use JsonObject */ not null default '{}',
  logto_config JSON /* @use JsonObject */ not null default '{}',
  mfa_verifications JSON /* @use MfaVerifications */ not null default '[]',
  is_suspended boolean not null default false,
  is_password_expired boolean not null default false,
  last_sign_in_at DATETIME(3),
  password_updated_at DATETIME(3),
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  username_lower varchar(128) as (lower(username)) virtual,
  primary key (id),
  constraint users__username
    unique (tenant_id, username),
  constraint users__primary_email
    unique (tenant_id, primary_email),
  constraint users__primary_phone
    unique (tenant_id, primary_phone)
);

/* Unique index on (tenant_id, id) required for foreign key constraint in organization_user_relations table. */
create unique index users__id
  on users (tenant_id, id);

create index users__name
  on users (tenant_id, name);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP(3);

/* Supports case-insensitive username lookups and case-flip conflict detection. */
create index users__tenant_lower_username
  on users (tenant_id, username_lower);
