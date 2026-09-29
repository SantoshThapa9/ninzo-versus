export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
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
  if (error instanceof Error && error.message === "CredentialsSignin") {
    return "Invalid email or password.";
  }

  // Validation and database errors are useful in server logs, but their raw
  // messages expose implementation details and are not actionable for users.
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "ValidationError" || error.name === "ZodError")
  ) {
    const invalidFields = getInvalidFields(error);
    if (invalidFields.has("category"))
      return "Please choose a valid issue type.";
    if (invalidFields.has("summary")) {
      return "Please describe your issue in at least 8 characters.";
    }
    if (invalidFields.has("whatsappNumber")) {
      return "Please enter a valid WhatsApp number.";
    }
    if (invalidFields.has("matchId")) return "Please choose a valid match.";
    return "Please check the information you entered and try again.";
  }

  return "Something went wrong. Please try again.";
}

function getInvalidFields(error: object): Set<string> {
  const fields = new Set<string>();
  const validationError = error as {
    errors?: Record<string, unknown>;
    issues?: Array<{ path?: PropertyKey[] }>;
  };

  for (const field of Object.keys(validationError.errors ?? {}))
    fields.add(field);
  for (const issue of validationError.issues ?? []) {
    const [field] = issue.path ?? [];
    if (typeof field === "string") fields.add(field);
  }

  return fields;
}
