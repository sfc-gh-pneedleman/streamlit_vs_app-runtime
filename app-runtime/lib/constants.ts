/** App title — displayed in the nav header and browser tab */
export const APP_TITLE = 'Order review';

/** Path to the logo in /public (used in the header and as favicon) */
export const LOGO_SRC = '/icon.svg';

export const NAV_ITEMS: { label: string; href: string }[] = [];

export const FLAGS_TABLE = 'MY_DB.MY_SCHEMA.ORDER_FLAGS';
export const ORDERS_TABLE = 'SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS';
export const SOURCE_APP = 'app_runtime';

export const PRIORITIES = ['All', '1-URGENT', '2-HIGH', '3-MEDIUM', '4-NOT SPECIFIED', '5-LOW'];
export const STATUSES = ['All', 'F', 'O', 'P'];
