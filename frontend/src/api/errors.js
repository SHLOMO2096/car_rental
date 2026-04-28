export function normalizeApiError(err) {
  if (!err) {
    return { status: 0, detail: "אירעה שגיאה לא ידועה", headers: {}, raw: err };
  }

  if (typeof err === "string") {
    return { status: 0, detail: err, headers: {}, raw: err };
  }

  if (err.detail || err.status || err.headers) {
    return {
      status: err.status || 0,
      detail: err.detail || err.message || "אירעה שגיאה",
      headers: err.headers || {},
      raw: err.raw || err,
    };
  }

  return {
    status: 0,
    detail: err.message || "אירעה שגיאה",
    headers: {},
    raw: err,
  };
}

export function getUserFacingErrorMessage(err) {
  const apiErr = normalizeApiError(err);

  if (apiErr.status === 429) {
    const retryAfter = apiErr.headers?.["retry-after"] || apiErr.headers?.["Retry-After"];
    if (retryAfter) {
      return `בוצעו יותר מדי בקשות. נסה שוב בעוד ${retryAfter} שניות.`;
    }
    return "בוצעו יותר מדי בקשות. נסה שוב בעוד רגע.";
  }

  if (apiErr.status === 403) {
    return apiErr.detail || "אין לך הרשאה לבצע פעולה זו.";
  }

  if (apiErr.status === 409) {
    return apiErr.detail || "המערכת זיהתה התנגשות בנתונים. נסה שוב.";
  }

  if (apiErr.status === 401) {
    return apiErr.detail || "נדרשת התחברות מחדש.";
  }

  return apiErr.detail || "אירעה שגיאה. נסה שוב.";
}

