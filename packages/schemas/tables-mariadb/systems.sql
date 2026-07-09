create table systems (
  key varchar(256) not null,
  value JSON /* @use JsonObject */ not null default '{}',
  primary key (key)
);

/* no_after_each */
