/* init_order = 1 */

create table oidc_model_instances (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  model_name varchar(64) not null,
  id varchar(128) not null,
  payload JSON /* @use OidcModelInstancePayload */ not null,
  expires_at DATETIME(3) not null,
  consumed_at DATETIME(3),
  payload_user_code varchar(128) as (json_unquote(json_extract(payload, '$.userCode'))) virtual,
  payload_uid varchar(128) as (json_unquote(json_extract(payload, '$.uid'))) virtual,
  payload_grant_id varchar(128) as (json_unquote(json_extract(payload, '$.grantId'))) virtual,
  payload_account_id varchar(128) as (json_unquote(json_extract(payload, '$.accountId'))) virtual,
  primary key (id),
  constraint oidc_model_instances__model_name_id
    unique (tenant_id, model_name, id)
);

create index oidc_model_instances__model_name_payload_user_code
  on oidc_model_instances (tenant_id, model_name, payload_user_code);

create index oidc_model_instances__model_name_payload_uid
  on oidc_model_instances (tenant_id, model_name, payload_uid);

create index oidc_model_instances__model_name_payload_grant_id_partial
  on oidc_model_instances (tenant_id, model_name, payload_grant_id);

create index oidc_model_instances__expires_at
  on oidc_model_instances (tenant_id, expires_at);

create index oidc_model_instances__model_name_payload_account_id_expires_at
  on oidc_model_instances (tenant_id, model_name, payload_account_id, expires_at);
