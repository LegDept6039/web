import type { SupabaseClient } from "@supabase/supabase-js";
import { roles, type Role } from "@/lib/offices/permissions";
import { authDiagnostic, errorCode, databaseMessage } from "./diagnostics";

type Profile = {
  user_id: string;
  email: string;
  username: string;
  display_name: string;
  role: Role;
  active: boolean;
  deleted_at: string | null;
  transparency_access?: boolean;
};
type Resolution =
  { ok: true; profile: Profile } | { ok: false; message: string };

/** Resolve access with the authenticated user's client, never the Auth Admin client. */
export async function resolveStaff(
  client: SupabaseClient,
  userId: string,
): Promise<Resolution> {
  const {
    data: profile,
    error,
    status,
  } = await client
    .from("staff_accounts")
    .select(
      "user_id,email,username,display_name,role,active,deleted_at,transparency_access",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    const code = errorCode(error);
    authDiagnostic("profile", {
      outcome: "query_error",
      userId,
      code,
      databaseMessage: databaseMessage(error),
      status,
    });
    return {
      ok: false,
      message: `Sign-in succeeded, but your staff profile could not be loaded${code ? ` (${code})` : ""}. Contact your administrator to check database access and migrations.`,
    };
  }
  authDiagnostic("profile", {
    outcome: "ok",
    userId,
    profilePresent: !!profile,
    active: profile?.active === true,
    role: profile && roles.includes(profile.role) ? profile.role : undefined,
  });
  if (!profile) {
    authDiagnostic("profile", { outcome: "missing_or_not_visible", userId });
    return {
      ok: false,
      message:
        "Sign-in succeeded, but no staff profile is available for your Auth account. Ask your administrator to check its UUID linkage and read policy.",
    };
  }
  if (profile.user_id !== userId) {
    authDiagnostic("profile", { outcome: "uuid_mismatch", userId });
    return {
      ok: false,
      message:
        "Your staff profile does not match your Auth account. Contact your administrator.",
    };
  }
  if (!profile.active || profile.deleted_at) {
    authDiagnostic("profile", { outcome: "disabled", userId });
    return {
      ok: false,
      message:
        "Your staff account is inactive or removed. Contact your administrator.",
    };
  }
  if (!roles.includes(profile.role)) {
    authDiagnostic("profile", { outcome: "invalid_role", userId });
    return {
      ok: false,
      message:
        "Your staff role is not recognized. Ask your administrator to check the account configuration.",
    };
  }
  // Superadmins and explicitly assigned Transparency staff need no department membership.
  if (profile.role === "superadmin" || profile.transparency_access === true)
    return { ok: true, profile: profile as Profile };
  const ids: string[] = [];
  for (let offset = 0; ; offset += 200) {
    const result = await client
      .from("user_office_access")
      .select("office_id,permission_level")
      .eq("user_id", userId)
      .order("office_id")
      .range(offset, offset + 199);
    if (result.error) {
      const code = errorCode(result.error);
      authDiagnostic("membership", {
        outcome: "query_error",
        userId,
        code,
        databaseMessage: databaseMessage(result.error),
        status: result.status,
      });
      return {
        ok: false,
        message: `Sign-in succeeded, but your department access could not be loaded${code ? ` (${code})` : ""}. Contact your administrator.`,
      };
    }
    ids.push(
      ...(result.data || [])
        .filter((m) =>
          ["viewer", "editor", "manager"].includes(m.permission_level),
        )
        .map((m) => m.office_id),
    );
    if ((result.data?.length || 0) < 200) break;
  }
  for (let offset = 0; offset < ids.length; offset += 200) {
    const result = await client
      .from("departments")
      .select("id")
      .in("id", ids.slice(offset, offset + 200))
      .eq("active", true)
      .is("archived_at", null)
      .limit(1);
    if (result.error) {
      const code = errorCode(result.error);
      authDiagnostic("department", {
        outcome: "query_error",
        userId,
        code,
        databaseMessage: databaseMessage(result.error),
        status: result.status,
      });
      return {
        ok: false,
        message: `Sign-in succeeded, but your assigned departments could not be loaded${code ? ` (${code})` : ""}. Contact your administrator to check database access and migrations.`,
      };
    }
    if (result.data?.length) {
      authDiagnostic("membership", {
        outcome: "ok",
        userId,
        membershipCount: ids.length,
      });
      return { ok: true, profile: profile as Profile };
    }
  }
  authDiagnostic("membership", {
    outcome: "no_active_department",
    userId,
    membershipCount: ids.length,
  });
  return {
    ok: false,
    message:
      "Your staff account has no active department assignment. Ask your administrator to assign Office Access.",
  };
}
