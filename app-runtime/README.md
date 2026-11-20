# Order review (Snowflake App Runtime)

Next.js version of the "Order review" demo used in the Streamlit vs App Runtime comparison. It does the same three things as the Streamlit app in `../streamlit/`:

1. **Explore**: revenue by month and the top 200 orders, filtered by order priority and status (`SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS`).
2. **Flag an order**: type or pick an order key, add a reason (required, max 500 characters), confirm, and save to `MY_DB.MY_SCHEMA.ORDER_FLAGS` with `SOURCE_APP = 'app_runtime'`. The insert only writes if the order exists.
3. **History**: the 10 most recent flags.

## How it uses Snowflake

- **Explore and the flag insert run with owner's rights** through `snowflake.query()` (`lib/snowflake.ts`), the same as the Streamlit app.
- **The viewer's identity** comes from a caller's-rights query (`lib/viewer.ts`): `SYS_CONTEXT('SNOWFLAKE$SESSION','PRINCIPAL_NAME')` and `'PRINCIPAL_EMAIL'`, read in a caller's-rights query. No privilege needed.
- `FLAGGED_BY_EMAIL` is masked by a masking policy, and History is read with caller's rights, so the mask applies to the signed-in user's role.
- Order-key typeahead is a native `<datalist>` over the top 10,000 orders by price. Any key can still be typed.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /api/revenue`, `GET /api/orders` (incl. month filter) | Explore tab (filters validated against allowed values) |
| `GET /api/order-keys` | Typeahead list |
| `GET /api/me` | Viewer name and email |
| `GET/POST /api/flags` | History (caller's rights) and write-back (owner's rights) |

## Run and deploy

```bash
npm ci
npm run dev          # local, uses your default Snowflake CLI connection
snow app deploy --verbose   # deploys using app.yml (name, database, schema, warehouse are set there)
```

Edit `app.yml` for your own database, schema and warehouse. Requires Snowflake CLI 3.26.0 or later and an account where App Runtime is available.
