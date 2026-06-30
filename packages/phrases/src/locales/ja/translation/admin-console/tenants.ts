const tenants = {
  title: '設定',
  description: 'テナントの設定を効率的に管理し、ドメインをカスタマイズします。',
  oss_description:
    'こちらでアカウント設定を変更し、個人情報を管理して、アカウントの安全性を確保してください。',
  tabs: {
    settings: '設定',
    members: 'メンバー',
    domains: 'ドメイン',
    oidc_configs: 'OIDC 設定',
    amember_sync: 'aMember sync',
    subscription: 'プランと請求',
    billing_history: '請求履歴',
  },
  members: {
    card_title: 'Logto Cloud でテナントをより安全に管理',
    card_description:
      '1つの管理者アカウントを共有せずに、テナントに管理者やコラボレーターを追加できます。',
    card_action: 'Logto Cloud を見る',
  },
  settings: {
    title: '設定',
    description: 'テナント名を設定し、ホストされているデータの地域とテナントタイプを表示します。',
    tenant_id: 'テナントID',
    tenant_name: 'テナント名',
    tenant_instance: 'インスタンスを選択してください',
    tenant_instance_description:
      'テナントをホストする場所を選択してください。パブリック共有インフラストラクチャの Logto Cloud を選択するか、専用リソース用のプライベートインスタンスを選択します。',
    tenant_region: 'データがホストされている地域',
    tenant_region_description:
      'テナントリソース（ユーザー、アプリなど）がホストされている物理的な場所です。作成後に変更することはできません。',
    tenant_region_tip: 'テナントのリソースは {{region}} にホストされています。 <a>詳細</a>',
    environment_tag_development: '開発',
    environment_tag_production: '本番',
    tenant_type: 'テナントタイプ',
    development_description:
      'テスト用であり、本番で使用すべきではありません。サブスクリプションは必要ありません。すべてのプロの機能がありますが、サインインバナーなどの制限があります。',
    production_description:
      'エンドユーザーに使用することを意図しており、有料のサブスクリプションが必要なアプリ向け。',
    tenant_info_saved: 'テナント情報は正常に保存されました。',
    tenant_mfa: '多要素認証',
    tenant_mfa_description:
      'メンバーがこのテナントにアクセスするために多要素認証を設定することを要求します。',
    enterprise_sso: 'エンタープライズ SSO',
    enterprise_sso_description:
      '有料プランで利用可能です。お問い合わせいただくと、すべてのメンバーが組織のアイデンティティプロバイダーを使用して Logto Cloud コンソールにサインインできるようになります。',
  },
  full_env_tag: {
    development: '開発',
    production: '本番',
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
    enabled: 'Enable automatic inbound sync',
    interval_seconds: 'Inbound sync interval (seconds)',
    sync_passwords: 'Sync password hashes from aMember',
    role_sync_mode: 'Product role sync',
    role_sync_one_way: 'One-way (aMember → Auth)',
    role_sync_two_way: 'Two-way',
    role_sync_hint:
      'One-way: scheduled inbound sync applies aMember access to Logto product roles; manual Logto role changes do not update aMember. Two-way: manual Logto role grants and revocations also create or expire lifetime aMember access.',

    identity_hint:
      'User passkeys, social identities, MFA settings, and other Logto profile data are never modified by aMember sync.',
    mode_api: 'aMember REST API',
    mode_database: 'MariaDB / MySQL database (recommended)',
    api_url: 'API URL',
    api_key: 'API key',
    database_url: 'Database URL',
    table_prefix: 'Table prefix',
    secret_saved_placeholder: 'Saved — leave blank to keep current value',
    hybrid_recommended:
      'Recommended: use MySQL for inbound sync and the REST API for outbound push (signups, profiles, and passwords). Enable two-way role sync only if Logto should also grant aMember access.',
    database_configured: 'Database connection saved.',
    database_not_configured: 'Database URL is required for MySQL inbound sync.',
    api_configured: 'API credentials saved.',
    api_not_configured: 'API URL and key are required for outbound sync.',
    run_now: 'Run inbound sync now',
    sync_triggered: 'aMember inbound sync started.',
  },

  deletion_card: {
    title: '削除',
    tenant_deletion: 'テナントの削除',
    tenant_deletion_description:
      'テナントの削除は、関連するすべてのユーザーデータと設定の永久的な削除につながります。十分に注意して操作してください。',
    tenant_deletion_button: 'テナントを削除する',
  },
  leave_tenant_card: {
    title: '退出',
    leave_tenant: 'テナントを退出する',
    leave_tenant_description:
      'テナント内のリソースは保持されますが、これ以上このテナントにアクセスできません。',
    last_admin_note:
      'このテナントを退出するには、少なくとも1人の他のメンバーが管理者の役割を持つことを確認してください。',
  },
  create_modal: {
    title: 'テナントを作成する',
    subtitle: '隔離されたリソースとユーザーを持つ新しいテナントを作成します。',
    tenant_id: 'テナントID',
    tenant_usage_purpose: 'このテナントを使用する目的は何ですか？',
    development_description:
      'テスト用であり、本番で使用すべきではありません。サブスクリプションは必要ありません。',
    development_description_for_private_regions: 'テスト用であり、本番で使用すべきではありません。',
    development_hint: 'すべてのプロの機能がありますが、サインインバナーなどの制限があります。',
    production_description:
      'エンドユーザーに使用することを意図しており、有料のサブスクリプションが必要なアプリ向け。',
    available_plan: '利用可能なプラン:',
    create_button: 'テナントを作成する',
    tenant_name_placeholder: '私のテナント',
    tenant_created: 'テナントが正常に作成されました。',
    invitation_failed:
      '一部の招待を送信できませんでした。後で設定 -> メンバーで再試行してください。',
    tenant_type_description: '作成後に変更することはできません。',
    tenant_id_invalid:
      'テナントIDには小文字、数字、ハイフンのみ使用でき、{{max}}文字を超えることはできません。',
    tenant_id_placeholder: 'テナントID',
    tenant_id_tip:
      'テナントIDをカスタマイズします。空のままにすると、Logtoがデフォルトのidを生成します。テナントIDは作成後に変更できません。',
  },
  dev_tenant_migration: {
    title: '新しい「開発テナント」を作成して、プロの機能を無料でお試しできます！',
    affect_title: 'これはあなたにどのように影響しますか？',
    hint_1:
      '古い<strong> 環境タグ </strong>が2つの新しいテナントタイプ<strong> 「開発」</strong>および<strong> 「本番」</strong>に置き換えられます。',
    hint_2:
      'シームレスな移行と機能の連続性を保証するため、すべての早期に作成されたテナントは、前のサブスクリプションとともに<strong> 本番 </strong>テナントタイプに昇格されます。',
    hint_3: 'ご安心ください、他のすべての設定は変わりません。',
    about_tenant_type: 'テナントタイプについて',
  },
  delete_modal: {
    title: 'テナントを削除します',
    description_line1:
      'あなたはテナント "<span>{{name}}</span>" を環境接尾辞タグ "<span>{{tag}}</span>" と共に削除してもよろしいでしょうか？ この操作は取り消すことができず、すべてのデータとテナント情報が永久に削除されます。',
    description_line2:
      'テナントを削除する前に、お手伝いできることがあるかもしれません。 <span><a>電子メールでお問い合わせ</a></span>',
    description_line3:
      '続行する場合は、テナント名 "<span>{{name}}</span>" を入力して確認してください。',
    delete_button: '完全に削除する',
    cannot_delete_title: 'このテナントは削除できません',
    cannot_delete_description:
      '申し訳ありませんが、現時点ではこのテナントを削除できません。無料プランに登録しており、未払いの請求がないことを確認してください。',
  },
  leave_tenant_modal: {
    description: 'このテナントを退出してもよろしいですか？',
    leave_button: '退出',
  },
  tenant_landing_page: {
    title: 'まだテナントを作成していません',
    description:
      'Logto でプロジェクトを設定するには、新しいテナントを作成してください。ログアウトまたはアカウントを削除する必要がある場合は、右上隅のアバターボタンをクリックしてください。',
    create_tenant_button: 'テナントを作成',
  },
  status: {
    mau_exceeded: 'MAUの制限を超えました',
    token_exceeded: 'トークンを超えました',
    suspended: '一時停止中',
    overdue: '期限切れ',
  },
  tenant_suspended_page: {
    title: 'テナントが一時停止されました。アクセスを復元するにはお問い合わせください。',
    description_1:
      '誠に申し訳ありませんが、ご利用のテナントアカウントが一時的に停止されました。MAU制限を超えた、支払いの遅延、その他の不正な操作などが原因です。',
    description_2:
      '詳細な説明や懸念事項がある場合、または機能を完全に復元しテナントをアンブロックする場合は、直ちにお問い合わせください。',
  },
  production_tenant_notification: {
    text: '無料テスト用の開発テナントにいます。本番テナントを作成して本稼働に移行してください。',
    action: 'テナントを作成する',
  },
};

export default Object.freeze(tenants);
