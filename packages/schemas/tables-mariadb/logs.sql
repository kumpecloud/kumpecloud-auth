/* init_order = 2 */

create table logs (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  key varchar(128) not null,
  payload JSON /* @use LogContextPayload */ not null default '{}',
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  primary key (id)
);

create index logs__key
  on logs (tenant_id, key);

create index logs__user_id
  on logs (tenant_id, (payload->>'userId'));

create index logs__application_id
  on logs (tenant_id, (payload->>'applicationId'));

create index logs__hook_id
  on logs (tenant_id, (payload->>'hookId'));

create index logs__created_at_id
  on logs (tenant_id, created_at, id);
