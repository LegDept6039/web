import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const temporaryPassword = () =>
  `Pm7!${randomBytes(24).toString("base64url")}`;
export const passwordDigest = (password: string) =>
  createHash("sha256").update(password).digest("hex");

export function equalDigest(left: string, right: string) {
  return (
    /^[a-f0-9]{64}$/.test(left) &&
    /^[a-f0-9]{64}$/.test(right) &&
    timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"))
  );
}

export type ResetProof = {
  userId: string;
  generation: string;
  sessionId: string;
  expiresAt: string;
};
export function signResetProof(proof: ResetProof, secret: string) {
  const payload = Buffer.from(JSON.stringify(proof)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function verifyResetProof(
  value: string,
  secret: string,
): ResetProof | null {
  if (value.length > 2000) return null;
  const parts = value.split(".");
  const [payload, signature] = parts;
  if (
    parts.length !== 2 ||
    !payload ||
    !signature ||
    !equalDigest(
      signature,
      createHmac("sha256", secret).update(payload).digest("hex"),
    )
  )
    return null;
  try {
    const proof = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as ResetProof;
    const uuid =
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (
      ![proof.userId, proof.generation, proof.sessionId].every(
        (v) => typeof v === "string" && uuid.test(v),
      ) ||
      typeof proof.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(proof.expiresAt))
    )
      return null;
    return proof;
  } catch {
    return null;
  }
}
