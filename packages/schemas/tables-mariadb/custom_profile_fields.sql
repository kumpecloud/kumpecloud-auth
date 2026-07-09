create table custom_profile_fields (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  name varchar(128) not null,
  type varchar(128) not null /* @use CustomProfileFieldType */,
  label varchar(128) not null default '',
  description varchar(256),
  required boolean not null default false,
  config JSON /* @use CustomProfileFieldConfig */ not null default ('{}'),
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  sie_order smallint not null default 0,
  primary key (id),
  constraint custom_profile_fields__name
    unique (tenant_id, name)
);

CREATE TRIGGER custom_profile_fields__increment_sie_order BEFORE INSERT ON custom_profile_fields
FOR EACH ROW
BEGIN
  IF NEW.sie_order IS NULL OR NEW.sie_order = 0 THEN
    SET NEW.sie_order = (
      SELECT COALESCE(MAX(sie_order), 0) + 1
      FROM custom_profile_fields
      WHERE tenant_id = COALESCE(NEW.tenant_id, @logto_tenant_id)
    );
  END IF;
END;
