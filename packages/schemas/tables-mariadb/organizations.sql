/* init_order = 1 */

/** Organizations defined by [RFC 0001](https://github.com/logto-io/rfcs/blob/HEAD/active/0001-organization.md). */
create table organizations (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  /** The globally unique identifier of the organization. */
  id varchar(21) not null,
  /** The organization's name for display. */
  name varchar(128) not null,
  /** A brief description of the organization. */
  description varchar(256),
  /** Additional data associated with the organization. */
  custom_data JSON /* @use JsonObject */ not null default '{}',
  /** Whether multi-factor authentication configuration is required for the members of the organization. */
  is_mfa_required boolean not null default false,
  /** The organization's branding color configuration. */
  color JSON /* @use PartialColor */ not null default '{}',
  /** The organization's branding configuration. */
  branding JSON /* @use Branding */ not null default '{}',
  /** The custom CSS of the organization. */
  custom_css text,
  /** When the organization was created. */
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id)
);

create index organizations__id
  on organizations (tenant_id, id);
