import { asCaller } from '@/lib/snowflake';

export type Viewer = { userName: string; email: string | null };

/**
 * App Runtime has no st.user equivalent. One caller's-rights query returns the signed-in user's
 * name and email from the session itself, so it needs no privilege on the user object and no
 * caller grant. PRINCIPAL_EMAIL is NULL when the user has no email set.
 */
export async function getViewer(): Promise<Viewer> {
  const caller = await asCaller();
  const { rows } = await caller.query<{ U: string; E: string | null }>(
    `SELECT SYS_CONTEXT('SNOWFLAKE$SESSION', 'PRINCIPAL_NAME') AS U,
            SYS_CONTEXT('SNOWFLAKE$SESSION', 'PRINCIPAL_EMAIL') AS E`,
  );
  return { userName: rows[0].U, email: rows[0].E || null };
}
