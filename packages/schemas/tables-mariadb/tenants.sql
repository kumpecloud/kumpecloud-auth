/* init_order = 0 */

create table tenants (
  id varchar(21) not null,
  db_user varchar(128),
  db_user_password varchar(128),
  name varchar(128) not null default 'My Project',
  tag varchar(64) not null default 'development',
  created_at DATETIME(3) not null default current_timestamp(3),
  is_suspended boolean not null default false,
  primary key (id),
  constraint tenants__db_user
    unique (db_user)
);
/* no_after_each */
