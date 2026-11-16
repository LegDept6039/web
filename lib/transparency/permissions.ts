type TransparencyProfile = {
  role: string;
  active: boolean;
  deleted_at: string | null;
  transparency_access?: boolean;
};

export function transparencyAccess(
  profile: TransparencyProfile,
  manage = false,
) {
  if (!profile.active || profile.deleted_at) return false;
  if (profile.role === "superadmin") return true;
  return (
    profile.transparency_access === true &&
    (manage ? ["admin", "editor"] : ["admin", "editor", "viewer"]).includes(
      profile.role,
    )
  );
}
