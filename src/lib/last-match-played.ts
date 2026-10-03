export function normalizeLastMatchPlayed(
  value: unknown,
): Date | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") return null;

  const isoDateMatch = /^\s*ISODate\(\s*(["'])(.*?)\1\s*\)\s*$/.exec(value);
  const normalizedValue = isoDateMatch ? isoDateMatch[2] : value;
  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function lastMatchPlayedDateExpression(
  fieldPath = "$lastMatchPlayed",
) {
  return {
    $let: {
      vars: { value: { $ifNull: [fieldPath, null] } },
      in: {
        $switch: {
          branches: [
            {
              case: { $eq: [{ $type: "$$value" }, "date"] },
              then: "$$value",
            },
            {
              case: { $eq: [{ $type: "$$value" }, "string"] },
              then: {
                $let: {
                  vars: {
                    isoDate: {
                      $regexFind: {
                        input: "$$value",
                        regex:
                          "^\\s*ISODate\\(\\s*[\"']([^\"']+)[\"']\\s*\\)\\s*$",
                      },
                    },
                  },
                  in: {
                    $convert: {
                      input: {
                        $ifNull: [
                          {
                            $arrayElemAt: [
                              { $ifNull: ["$$isoDate.captures", []] },
                              0,
                            ],
                          },
                          "$$value",
                        ],
                      },
                      to: "date",
                      onError: null,
                      onNull: null,
                    },
                  },
                },
              },
            },
          ],
          default: null,
        },
      },
    },
  };
}
