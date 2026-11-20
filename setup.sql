-- Run once, as a role that can create objects.
-- configure.sh has already replaced MY_DB / MY_SCHEMA / MY_WAREHOUSE.
-- Replace <execution_role> with the role your App Runtime app runs as.

CREATE SCHEMA IF NOT EXISTS MY_DB.MY_SCHEMA;

CREATE TABLE IF NOT EXISTS MY_DB.MY_SCHEMA.ORDER_FLAGS (
  FLAG_ID INT AUTOINCREMENT,
  ORDER_KEY NUMBER,
  REASON VARCHAR(500),
  FLAGGED_BY VARCHAR DEFAULT CURRENT_USER(),
  SOURCE_APP VARCHAR,
  CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  FLAGGED_BY_EMAIL VARCHAR(200)
);

-- Mask the email's local part for everyone except a reviewer role.
CREATE MASKING POLICY MY_DB.MY_SCHEMA.MASK_EMAIL_TO_DOMAIN AS (val VARCHAR) RETURNS VARCHAR ->
  CASE WHEN IS_ROLE_IN_SESSION('ORDER_REVIEWER') THEN val
       WHEN val IS NULL THEN NULL
       ELSE REGEXP_REPLACE(val, '^[^@]+', '***') END;
ALTER TABLE MY_DB.MY_SCHEMA.ORDER_FLAGS
  MODIFY COLUMN FLAGGED_BY_EMAIL SET MASKING POLICY MY_DB.MY_SCHEMA.MASK_EMAIL_TO_DOMAIN;

-- History is read with caller's rights, so the app's execution role needs caller grants.
-- Use a dedicated execution role for real deployments, not SYSADMIN.
GRANT CALLER DATA READ ON SCHEMA MY_DB.MY_SCHEMA TO ROLE <execution_role>;
GRANT CALLER USAGE ON WAREHOUSE MY_WAREHOUSE TO ROLE <execution_role>;
