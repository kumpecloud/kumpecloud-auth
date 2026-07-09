/* MariaDB: triggers only — no RLS. Tenant isolation via TenantGuard + @logto_tenant_id session. */

CREATE TRIGGER ${name}_set_tenant_id BEFORE INSERT ON ${name}
FOR EACH ROW
BEGIN
  IF NEW.tenant_id IS NULL AND @logto_tenant_id IS NOT NULL THEN
    SET NEW.tenant_id = @logto_tenant_id;
  END IF;
END;
