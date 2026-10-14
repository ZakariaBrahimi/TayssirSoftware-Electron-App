/**
 * Landing page settings: set your prices and contact details here.
 * A price left at `null` shows "Price on request"; an empty contact is hidden.
 */
export const landingConfig = {
  pricing: {
    /** Cloud subscription, per month, in dinars. */
    cloudMonthly: null as number | null,
    /** Desktop license, one payment, in dinars. */
    licenseOneTime: null as number | null,
  },
  /** Windows installer (the latest GitHub release). */
  downloadUrl: "https://github.com/ZakariaBrahimi/TayssirSoftware-Electron-App/releases/latest",
  contact: {
    /** e.g. "+213 555 12 34 56" */
    phone: "",
    /** WhatsApp number in international format without "+" or spaces, e.g. "213555123456". */
    whatsapp: "",
    email: "",
  },
};
