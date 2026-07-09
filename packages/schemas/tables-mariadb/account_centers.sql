create table account_centers (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  /** The whole feature can be disabled */
  enabled boolean not null default true,
  /** Control each fields */
  fields JSON /* @use AccountCenterFieldControl */ not null default '{}',
  webauthn_related_origins JSON /* @use WebauthnRelatedOrigins */ not null default '[]',
  /** URL for custom account deletion endpoint */
  delete_account_url varchar(2048),
  /** User-defined custom CSS for the account center */
  custom_css text,
  /** Ordered list of custom profile fields to show in the prebuilt account center */
  profile_fields JSON /* @use AccountCenterProfileFields */,
  /** When enabled, users without a custom avatar use their Gravatar image based on primary email */
  gravatar_enabled boolean not null default false,
  primary key (tenant_id, id)
);
