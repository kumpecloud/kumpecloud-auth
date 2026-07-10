create table sign_in_experiences (
  tenant_id varchar(21) not null
    references tenants (id) on update cascade on delete cascade,
  id varchar(21) not null,
  color JSON /* @use Color */ not null,
  branding JSON /* @use Branding */ not null,
  hide_logto_branding boolean not null default false,
  language_info JSON /* @use LanguageInfo */ not null,
  terms_of_use_url varchar(2048),
  privacy_policy_url varchar(2048),
  /** The policy that determines how users agree to the terms of use and privacy policy. */
  agree_to_terms_policy varchar(22) not null default 'Automatic',
  sign_in JSON /* @use SignIn */ not null,
  sign_up JSON /* @use SignUp */ not null,
  social_sign_in JSON /* @use SocialSignIn */ not null default '{}',
  social_sign_in_connector_targets JSON /* @use ConnectorTargets */ not null default '[]',
  sign_in_mode varchar(17) not null default 'SignInAndRegister',
  custom_css text,
  custom_content JSON /* @use CustomContent */ not null default '{}',
  custom_ui_assets JSON /* @use CustomUiAssets */,
  custom_ui_csp JSON /* @use CustomUiCsp */ not null default '{}',
  password_policy JSON /* @use PartialPasswordPolicy */ not null default '{}',
  mfa JSON /* @use Mfa */ not null default '{}',
  adaptive_mfa JSON /* @use AdaptiveMfa */ not null default '{}',
  single_sign_on_enabled boolean not null default false,
  support_email text,
  support_website_url text,
  unknown_session_redirect_url text,
  captcha_policy JSON /* @use CaptchaPolicy */ not null default '{}',
  sentinel_policy JSON /* @use SentinelPolicy */ not null default '{}',
  email_blocklist_policy JSON /* @use EmailBlocklistPolicy */ not null default '{}',
  verification_code_policy JSON /* @use VerificationCodePolicy */ not null default '{}',
  forgot_password_methods JSON /* @use ForgotPasswordMethods */ default '[]',
  passkey_sign_in JSON /* @use PasskeySignIn */ not null default '{}',
  /** Nullable by design: null keeps legacy full-catalog behavior, and new rows default to [] to collect no custom profile fields. */
  sign_up_profile_fields JSON /* @use SignUpProfileFields */ default '[]',
  password_expiration JSON /* @use PasswordExpirationPolicy */ not null default '{}',
  username_policy JSON /* @use UsernamePolicy */ not null default ('{
    "caseSensitive": true,
    "minLength": 1,
    "maxLength": 128,
    "allowedChars": {
      "lowercase": true,
      "uppercase": true,
      "numbers": true,
      "underscore": true
    }
  }'),
  primary key (tenant_id, id)
);
