export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function toErrorMessage(error: unknown) {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) {
    if (error.message === "CredentialsSignin") return "Invalid email or password.";
    return error.message;
  }
  return "Something went wrong.";
}
