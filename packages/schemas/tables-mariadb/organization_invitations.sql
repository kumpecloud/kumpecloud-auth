/* init_order = 3 */

/** The invitation entry defined in RFC 0003. It stores the invitation information for a user to join an organization. */
create table organization_invitations (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  /** The unique identifier of the invitation. */
  id varchar(21) not null,
  /** The user ID who sent the invitation. */
  inviter_id varchar(21)
    references users (id) on update cascade on delete cascade,
  /** The email address or other identifier of the invitee. */
  invitee varchar(256) not null,
  /** The user ID of who accepted the invitation. */
  accepted_user_id varchar(21)
    references users (id) on update cascade on delete cascade,
  /** The ID of the organization to which the invitee is invited. */
  organization_id varchar(21) not null
    references organizations (id) on update cascade on delete cascade,
  /** The status of the invitation. */
  status varchar(16) not null,
  /** The time when the invitation was created. */
  created_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  /** The time when the invitation status was last updated. */
  updated_at DATETIME(3) not null DEFAULT CURRENT_TIMESTAMP(3),
  /** The time when the invitation expires. */
  expires_at DATETIME(3) not null,
  pending_invitee_organization varchar(300) as (
    if(status = 'Pending', concat(tenant_id, ':', invitee, ':', organization_id), null)
  ) virtual,
  primary key (id)
);

-- Ensure there is only one pending invitation for a given invitee and organization.
create unique index organization_invitations__invitee_organization_id
  on organization_invitations (pending_invitee_organization);
