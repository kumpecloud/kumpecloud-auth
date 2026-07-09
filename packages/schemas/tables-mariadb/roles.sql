/* init_order = 1 */

create table roles (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  name varchar(128) not null,
  description varchar(128) not null,
  type varchar(16) not null default 'User',
  /** If the role is the default role for a new user. Should be ignored for `MachineToMachine` roles. */
  is_default boolean not null default false,
  primary key (id),
  constraint roles__name
    unique (tenant_id, name)
);

create index roles__id
  on roles (tenant_id, id);

create index roles__type
  on roles (tenant_id, type);
