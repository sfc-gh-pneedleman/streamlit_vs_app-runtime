# Streamlit in Snowflake vs Snowflake App Runtime: one app, built twice

The same "Order review" app on both platforms, so you can compare them on a real task.

| | Folder | Stack |
| --- | --- | --- |
| Streamlit in Snowflake (container runtime) | [`streamlit/`](streamlit) | Python |
| Snowflake App Runtime | [`app-runtime/`](app-runtime) | Next.js, shadcn/ui, Recharts |

Both apps have three tabs: **Explore** (revenue by month, click a month to filter, top 200 orders, click a row for details), **Flag an order** (validated write-back with an order-key type-ahead), and **History** (read as the signed-in user, with a masked email column).

Data: `SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS` plus one small table you create below.

## Setup

1. **Set your names once.** Open `configure.sh`, edit the three values at the top (database, schema, warehouse), and run it:

   ```bash
   ./configure.sh
   ```

   It fills them into `streamlit/snowflake.yml`, `streamlit/streamlit_app.py`, `app-runtime/app.yml`, `app-runtime/lib/constants.ts` and `setup.sql`. Run it once, on a fresh clone.

2. **Create the objects.** Run `setup.sql` as a role that can create objects. It creates the `ORDER_FLAGS` table, a masking policy on the email column, and the caller grants that let History run as the signed-in user. Replace `<execution_role>` first; use a dedicated role, not SYSADMIN, for real deployments.

3. **Streamlit only:** the type-ahead uses `streamlit-smart-text-input` from PyPI, so create an external access integration for PyPI and list it under `external_access_integrations` in `streamlit/snowflake.yml`.

## Deploy

```bash
# Streamlit
cd streamlit && snow streamlit deploy --replace

# App Runtime
cd app-runtime && npm ci && snow app deploy --verbose
```

Requires Snowflake CLI 3.26+ and an account with Streamlit container runtime and App Runtime enabled.

## What each side shows

- **Streamlit:** built-in table cell charts and progress bars (`st.column_config`), `st.dialog`, `st.user`, shared `st.cache_data`.
- **App Runtime:** browser-side search and sort, custom UI, your own API routes, per-query choice of owner's or caller's rights, scale-out beyond one instance.
