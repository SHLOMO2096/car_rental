// Centralized defaults for system settings.
// These are used both by the Settings page initial values and by feature fallbacks
// (e.g., when the backend doesn't have a stored row yet).

export const DEFAULT_GENERAL_SETTINGS = {
  default_pickup_time: "08:30",
  default_return_time: "08:00",
  closure_time: "12:00",
  grace_period_hours: "2",
  notification_emails: "",
  terms_text: "",
};

