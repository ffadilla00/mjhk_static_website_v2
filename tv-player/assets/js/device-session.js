const STORAGE_KEY = "mjhk.tv.device-session.v1";

export class DeviceSessionStore {
  constructor(storage = window.localStorage) {
    this.storage = storage;
  }

  load() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!isValidSession(parsed)) {
        this.clear();
        return null;
      }

      return {
        deviceCode: parsed.deviceCode,
        deviceToken: parsed.deviceToken,
        storedAt: parsed.storedAt || null,
      };
    } catch {
      this.clear();
      return null;
    }
  }

  save({ deviceCode, deviceToken }) {
    if (!deviceCode || !deviceToken) {
      throw new Error("deviceCode dan deviceToken wajib tersedia");
    }

    const payload = {
      deviceCode: String(deviceCode).trim(),
      deviceToken: String(deviceToken).trim(),
      storedAt: new Date().toISOString(),
    };

    this.storage.setItem(STORAGE_KEY, JSON.stringify(payload));

    return {
      deviceCode: payload.deviceCode,
      storedAt: payload.storedAt,
    };
  }

  clear() {
    this.storage.removeItem(STORAGE_KEY);
  }

  hasSession() {
    return Boolean(this.load());
  }

  describe() {
    const session = this.load();
    if (!session) return null;

    return {
      deviceCode: session.deviceCode,
      storedAt: session.storedAt,
      tokenPresent: true,
    };
  }
}

function isValidSession(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.deviceCode === "string" &&
    value.deviceCode.trim() &&
    typeof value.deviceToken === "string" &&
    value.deviceToken.trim()
  );
}
