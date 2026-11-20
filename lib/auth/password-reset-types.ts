export type ResetPasswordResult = {
  message: string;
  temporaryPassword?: string;
  expiresAt?: string;
};

export type PasswordResetStatus = {
  required: boolean;
  ready: boolean;
  generation: string | null;
  state: string | null;
  expires_at: string | null;
  session_id: string | null;
};
