import json

import streamlit as st
import altair as alt
from streamlit_smart_text_input import st_smart_text_input

st.set_page_config(page_title="Order review", layout="wide")

SOURCE_APP = "streamlit"
FLAGS_TABLE = "MY_DB.MY_SCHEMA.ORDER_FLAGS"

conn = st.connection("snowflake")
session = conn.session()
# Restricted caller's rights: queries run as the signed-in viewer (their default role).
# Created at the top of the script, because the caller token is short-lived.
caller_session = st.connection("snowflake-callers-rights").session()


@st.cache_data(ttl=600)
def revenue_by_month(priority, status):
    q = """
        SELECT TO_VARCHAR(DATE_TRUNC('month', O_ORDERDATE), 'YYYY-MM') AS MONTH, SUM(O_TOTALPRICE) AS REVENUE
        FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS
        WHERE (? = 'All' OR O_ORDERPRIORITY = ?) AND (? = 'All' OR O_ORDERSTATUS = ?)
        GROUP BY 1 ORDER BY 1
    """
    return session.sql(q, params=[priority, priority, status, status]).to_pandas()


@st.cache_data(ttl=600)
def orders(priority, status, month):
    q = """
        SELECT O_ORDERKEY, O_CUSTKEY, O_ORDERSTATUS, O_TOTALPRICE, O_ORDERDATE, O_ORDERPRIORITY
        FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS
        WHERE (? = 'All' OR O_ORDERPRIORITY = ?) AND (? = 'All' OR O_ORDERSTATUS = ?)
          AND (? = '' OR TO_VARCHAR(DATE_TRUNC('month', O_ORDERDATE), 'YYYY-MM') = ?)
        ORDER BY O_TOTALPRICE DESC LIMIT 200
    """
    return session.sql(q, params=[priority, priority, status, status, month, month]).to_pandas()


@st.cache_data(ttl=600)
def trend_by_priority(status):
    q = """
        SELECT O_ORDERPRIORITY AS PRIORITY,
               ARRAY_AGG(REV) WITHIN GROUP (ORDER BY MONTH) AS MONTHLY_REVENUE,
               SUM(REV) AS TOTAL_REVENUE
        FROM (
          SELECT O_ORDERPRIORITY, DATE_TRUNC('month', O_ORDERDATE) AS MONTH, SUM(O_TOTALPRICE) AS REV
          FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS
          WHERE (? = 'All' OR O_ORDERSTATUS = ?)
          GROUP BY 1, 2
        )
        GROUP BY 1 ORDER BY 1
    """
    df = session.sql(q, params=[status, status]).to_pandas()
    df["MONTHLY_REVENUE"] = df["MONTHLY_REVENUE"].apply(lambda s: [float(x) for x in json.loads(s)])
    df["TOTAL_REVENUE"] = df["TOTAL_REVENUE"].astype(float)
    return df


@st.dialog("Order details")
def show_order(row):
    for label, value in row.items():
        st.write(f"**{label}**: {value}")
    st.caption("To flag this order, use the Flag an order tab.")


@st.cache_data(ttl=3600)
def top_order_keys():
    q = ("SELECT O_ORDERKEY FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS "
         "ORDER BY O_TOTALPRICE DESC LIMIT 10000")
    return [str(k) for k in session.sql(q).to_pandas()["O_ORDERKEY"].tolist()]


st.title("Order review")
tab_explore, tab_flag, tab_history = st.tabs(["Explore", "Flag an order", "History"])

with tab_explore:
    c1, c2 = st.columns(2)
    priority = c1.selectbox(
        "Order priority",
        ["All", "1-URGENT", "2-HIGH", "3-MEDIUM", "4-NOT SPECIFIED", "5-LOW"],
    )
    status = c2.selectbox("Order status", ["All", "F", "O", "P"])

    revenue = revenue_by_month(priority, status)
    month_sel = alt.selection_point(name="month_sel", fields=["MONTH"])
    chart = (
        alt.Chart(revenue)
        .mark_bar()
        .encode(
            x=alt.X("MONTH:N", sort=None, axis=alt.Axis(labelAngle=-90, title=None)),
            y=alt.Y("REVENUE:Q", title="Revenue"),
            opacity=alt.condition(month_sel, alt.value(1.0), alt.value(0.4)),
            tooltip=["MONTH", "REVENUE"],
        )
        .add_params(month_sel)
    )
    st.caption("Click a month to filter the orders below. Click again to clear.")
    event = st.altair_chart(chart, on_select="rerun", use_container_width=True, key="revenue_chart")
    picked = event.selection.get("month_sel", [])
    month = picked[0]["MONTH"] if picked else ""

    st.caption("Revenue trend by priority. The mini charts and bars are built-in table columns.")
    trend = trend_by_priority(status)
    st.dataframe(
        trend,
        hide_index=True,
        use_container_width=True,
        column_config={
            "MONTHLY_REVENUE": st.column_config.AreaChartColumn("Monthly revenue"),
            "TOTAL_REVENUE": st.column_config.ProgressColumn(
                "Total revenue", format="compact", min_value=0, max_value=float(trend["TOTAL_REVENUE"].max())
            ),
        },
    )

    order_rows = orders(priority, status, month)
    st.caption(f"Top 200 orders by price{' in ' + month if month else ''}. Click a row for details.")
    table = st.dataframe(
        order_rows,
        on_select="rerun",
        selection_mode="single-row",
        use_container_width=True,
        hide_index=True,
        key="orders_table",
        column_config={
            "O_TOTALPRICE": st.column_config.ProgressColumn(
                "Total price", format="dollar", min_value=0, max_value=float(order_rows["O_TOTALPRICE"].max() or 1)
            ),
        },
    )
    if table.selection.rows:
        show_order(order_rows.iloc[table.selection.rows[0]])

with tab_flag:
    order_key = st_smart_text_input(
        label="Order key",
        options=top_order_keys(),
        index=None,
        placeholder="Type or pick an order key, press Enter",
        delay=200,
        key="order_key_input",
    )
    if order_key:
        st.info(f"Selected order key: **{order_key}**")

    with st.form("flag_form", clear_on_submit=True):
        st.caption(f"Flagging as {st.user.user_name} ({st.user.email or 'no email on file'})")
        reason = st.text_area("Reason", max_chars=500)
        confirm = st.checkbox("I confirm this order should be flagged")
        submitted = st.form_submit_button("Flag order")
    if submitted:
        if not order_key or not str(order_key).strip().isdigit():
            st.error("Enter a numeric order key first.")
        elif not reason.strip():
            st.error("Reason is required.")
        elif not confirm:
            st.error("Please confirm before submitting.")
        else:
            result = session.sql(
                f"INSERT INTO {FLAGS_TABLE} (ORDER_KEY, REASON, FLAGGED_BY, SOURCE_APP, FLAGGED_BY_EMAIL) "
                "SELECT O_ORDERKEY, ?, ?, ?, ? FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS WHERE O_ORDERKEY = ?",
                params=[reason.strip(), st.user.user_name, SOURCE_APP, st.user.email, int(order_key)],
            ).collect()
            if result[0][0] == 0:
                st.error(f"Order {int(order_key)} does not exist.")
            else:
                st.success(f"Order {int(order_key)} flagged.")

with tab_history:
    try:
        viewer_role = caller_session.sql("SELECT CURRENT_ROLE()").collect()[0][0]
        history = caller_session.sql(
            f"SELECT ORDER_KEY, REASON, FLAGGED_BY, FLAGGED_BY_EMAIL, SOURCE_APP, CREATED_AT "
            f"FROM {FLAGS_TABLE} ORDER BY CREATED_AT DESC LIMIT 10"
        ).to_pandas()
        st.caption(f"Read as the signed-in user, role {viewer_role}")
        st.dataframe(history, use_container_width=True, hide_index=True)
    except Exception:
        st.error("Could not read History as the signed-in user. Caller grants may be missing.")
