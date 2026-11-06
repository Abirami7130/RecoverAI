export function apiError(
  code: string,
  message: string,
  status: number,
  extras?: Record<string, unknown>
) {
  return Response.json(
    {
      error: {
        code,
        message,
        ...(extras ?? {}),
      },
      ...extras,
    },
    { status }
  );
}
