create table email_templates (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  language_tag varchar(16) not null,
  template_type varchar(64) /* @use TemplateType */ not null,
  details JSON /* @use EmailTemplateDetails */ not null,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  primary key (tenant_id, id),
  constraint email_templates__tenant_id__language_tag__template_type
    unique (tenant_id, language_tag, template_type)
);

create index email_templates__tenant_id__language_tag
  on email_templates (tenant_id, language_tag);

create index email_templates__tenant_id__template_type
  on email_templates (tenant_id, template_type);
