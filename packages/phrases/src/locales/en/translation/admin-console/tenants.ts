const tenants = {
  title: 'Settings',
  description: 'Efficiently manage tenant settings and customize your domain.',
  oss_description:
    'Change your account settings and manage your personal information here to ensure your account security.',
  tabs: {
    settings: 'Settings',
    members: 'Members',
    domains: 'Domains',
    oidc_configs: 'OIDC configs',
    amember_sync: 'aMember sync',
    subscription: 'Plan and billing',
    billing_history: 'Billing history',
  },
  members: {
    card_title: 'Manage tenants more securely with Logto Cloud',
    card_description:
      'Add admins or collaborators to your tenant without sharing a single admin account.',
    card_action: 'Explore Logto Cloud',
  },
  settings: {
    title: 'SETTINGS',
    description: 'Set the tenant name and view your data hosted region and tenant type.',
    tenant_id: 'Tenant ID',
    tenant_name: 'Tenant name',
    tenant_instance: 'Select your instance',
    tenant_instance_description:
      'Select where your tenant will be hosted. Choose Logto Cloud for public shared infrastructure, or a private instance for dedicated resources.',
    tenant_region: 'Data region',
    tenant_region_description:
      'The physical location where your tenant resources (users, apps, etc.) are hosted. This cannot be changed after creation.',
    tenant_region_tip: 'Your tenant resources are hosted in {{region}}. <a>Learn more</a>',
    environment_tag_development: 'Dev',
    environment_tag_production: 'Prod',
    tenant_type: 'Tenant type',
    development_description:
      "For testing only and shouldn't be used in production. No subscription is required. It has all the pro features but has limitations like a sign-in banner.",
    production_description:
      'Intended for apps that are being used by end-users and may require a paid subscription.',
    tenant_info_saved: 'Tenant information saved successfully.',
    tenant_mfa: 'Multi-factor authentication',
    tenant_mfa_description:
      'Require your members to set up multi-factor authentication to access this tenant.',
    enterprise_sso: 'Enterprise SSO',
    enterprise_sso_description:
      "Available on paid plans. Contact us to enable enterprise SSO so all members can sign in to the Logto Cloud Console using your organization's identity provider.",
  },
  full_env_tag: {
    development: 'Development',
    production: 'Production',
  },
  amember_sync: {
    title: 'aMember sync',
    description:
      'Sync between aMember and Kumpecloud Auth. Inbound sync reads aMember via MySQL (recommended) or REST API. Outbound sync writes users, profiles, and passwords via REST API. Product roles use the format "{productId}: {title}". Role sync direction controls whether Logto role changes also update aMember.',
    general_title: 'GENERAL',
    inbound_title: 'INBOUND (aMember → Auth)',
    inbound_description:
      'Scheduled sync pulls products, users, access, and password hashes from aMember into Logto. MySQL is recommended for bulk reads.',
    inbound_mode: 'Inbound connection',
    inbound_api_hint: 'Inbound API credentials are configured in the Outbound section below.',
    outbound_title: 'OUTBOUND (Auth → aMember)',
    outbound_description:
      'Pushes signups, profile updates, and password changes to aMember via the REST API. Product role grants require two-way role sync.',
    outbound_enabled: 'Push signups, profiles, and passwords to aMember',
    role_sync_mode: 'Product role sync',
    role_sync_one_way: 'One-way (aMember → Auth)',
    role_sync_two_way: 'Two-way',
    role_sync_hint:
      'One-way: scheduled inbound sync applies aMember access to Logto product roles; manual Logto role changes do not update aMember. Two-way: manual Logto role grants and revocations also create or expire lifetime aMember access.',
    enabled: 'Enable automatic inbound sync',
    interval_seconds: 'Inbound sync interval (seconds)',
    sync_passwords: 'Sync password hashes from aMember',
    delete_logto_users_when_removed: 'Delete Logto users removed from aMember',
    delete_logto_users_when_removed_hint:
      'When enabled, inbound sync permanently deletes Logto users whose linked aMember account is inactive, marked deleted, or no longer returned by aMember. Off by default.',
    identity_hint:
      'User passkeys, social identities, MFA settings, and other Logto profile data are never modified by aMember sync.',
    mode_api: 'aMember REST API',
    mode_database: 'MariaDB / MySQL database (recommended)',
    api_url: 'API URL',
    api_key: 'API key',
    database_host: 'Server address',
    database_port: 'Port',
    database_user: 'Username',
    database_password: 'Password',
    database_name: 'Database',
    database_host_hint:
      'Use a hostname or IP reachable from the auth container. localhost only works if MySQL runs in the same container.',
    table_prefix: 'Table prefix',
    secret_saved_placeholder: 'Saved — leave blank to keep current value',
    hybrid_recommended:
      'Recommended: use MySQL for inbound sync and the REST API for outbound push (signups, profiles, and passwords). Enable two-way role sync only if Logto should also grant aMember access.',
    database_configured: 'Database connection saved.',
    database_not_configured:
      'Server address, username, database name, and password are required for MySQL inbound sync.',
    api_configured: 'API credentials saved.',
    api_not_configured: 'API URL and key are required for outbound sync.',
    run_now: 'Run inbound sync now',
    sync_triggered: 'aMember inbound sync started.',
    test_database_connection: 'Test MySQL connection',
    database_connection_ok: 'MySQL connection succeeded.',
  },
  deletion_card: {
    title: 'DELETE',
    tenant_deletion: 'Delete tenant',
    tenant_deletion_description:
      'Deleting the tenant will result in the permanent removal of all associated user data and configuration. Please proceed with caution.',
    tenant_deletion_button: 'Delete tenant',
  },
  leave_tenant_card: {
    title: 'LEAVE',
    leave_tenant: 'Leave tenant',
    leave_tenant_description:
      'Any resources in the tenant will remain but you no longer have access to this tenant.',
    last_admin_note: 'To leave this tenant, ensure at least one more member has the Admin role.',
  },
  create_modal: {
    title: 'Create tenant',
    subtitle: 'Create a new tenant that has isolated resources and users.',
    tenant_id: 'Tenant ID',
    tenant_usage_purpose: 'What do you want to use this tenant for?',
    development_description:
      "For testing only and shouldn't be used in production. No subscription is required.",
    development_description_for_private_regions:
      "For testing only and shouldn't be used in production.",
    development_hint: 'It has all the pro features but has limitations like a sign-in banner.',
    production_description: 'For use by end-users and may require a paid subscription.',
    available_plan: 'Available plan:',
    create_button: 'Create tenant',
    tenant_name_placeholder: 'My tenant',
    tenant_created: 'Tenant created successfully.',
    invitation_failed:
      'Some invitation failed to send. Please try again in Settings -> Members later.',
    tenant_type_description: 'This cannot be changed after creation.',
    tenant_id_invalid:
      'Tenant ID can only contain lowercase letters, numbers, and hyphens, and must not exceed {{max}} characters.',
    tenant_id_placeholder: 'Your tenant ID',
    tenant_id_tip:
      'Customize the Tenant ID. If left empty, Logto will generate a default ID. The Tenant ID cannot be changed after creation.',
  },
  dev_tenant_migration: {
    title: 'You can now try our Pro features for free by creating a new "Development tenant"!',
    affect_title: 'How does this affect you?',
    hint_1:
      'We are replacing the old <strong>environment tags</strong> with two new tenant types: <strong>“Development”</strong> and <strong>“Production”</strong>.',
    hint_2:
      'To ensure a seamless transition and uninterrupted functionality, all early-created tenants will be elevated to the <strong>Production</strong> tenant type along with your previous subscription.',
    hint_3: "Don't worry, all your other settings will remain the same.",
    about_tenant_type: 'About tenant type',
  },
  delete_modal: {
    title: 'Delete tenant',
    description_line1:
      'Are you sure you want to delete your tenant "<span>{{name}}</span>" with environment suffix tag "<span>{{tag}}</span>"? This action cannot be undone, and will result in the permanent deletion of all your data and tenant information.',
    description_line2:
      'Before deleting tenant, maybe we can help you. <span><a>Contact us via Email</a></span>',
    description_line3:
      'If you would like to proceed, please enter the tenant name "<span>{{name}}</span>" to confirm.',
    delete_button: 'Permanently delete',
    cannot_delete_title: 'Cannot delete this tenant',
    cannot_delete_description:
      "Sorry, you can't delete this tenant right now. Please make sure you're on the Free plan and have paid all outstanding billings.",
  },
  leave_tenant_modal: {
    description: 'Are you sure you want to leave this tenant?',
    leave_button: 'Leave',
  },
  tenant_landing_page: {
    title: "You haven't created a tenant yet",
    description:
      'To start configuring your project with Logto, please create a new tenant. If you need to log out or delete your account, just click on the avatar button in the top right corner.',
    create_tenant_button: 'Create tenant',
  },
  status: {
    mau_exceeded: 'MAU exceeded',
    token_exceeded: 'Token exceeded',
    suspended: 'Suspended',
    overdue: 'Overdue',
  },
  tenant_suspended_page: {
    title: 'Tenant suspended. Contact us to restore access.',
    description_1:
      'We deeply regret to inform you that your tenant account has been temporarily suspended due to improper use, including exceeding MAU limits, overdue payments, or other unauthorized actions.',
    description_2:
      'If you require further clarification, have any concerns, or wish to restore full functionality and unblock your tenants, please do not hesitate to contact us immediately.',
  },
  production_tenant_notification: {
    text: "You're in a dev tenant for free testing. Create a production tenant to go live.",
    action: 'Create tenant',
  },
};

export default Object.freeze(tenants);
