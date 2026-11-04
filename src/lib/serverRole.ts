import "server-only";
import { cookies } from "next/headers";
import { parseRole, ROLE_COOKIE, type AppRole } from "./role";

export async function getRole(): Promise<AppRole> {
  const c = await cookies();
  return parseRole(c.get(ROLE_COOKIE)?.value);
}
