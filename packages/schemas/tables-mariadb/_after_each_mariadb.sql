/* MariaDB: triggers only — no RLS. Tenant isolation via TenantGuard + @logto_tenant_id session.
   Trigger names use `_sti` (set tenant id) to stay within MariaDB's 64-char identifier limit. */

CREATE TRIGGER ${name}_sti BEFORE INSERT ON ${name}
FOR EACH ROW
BEGIN
  IF NEW.tenant_id IS NULL AND @logto_tenant_id IS NOT NULL THEN
    SET NEW.tenant_id = @logto_tenant_id;
  END IF;
END;
