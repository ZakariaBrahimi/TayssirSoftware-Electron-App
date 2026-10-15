/* eslint-disable prettier/prettier */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
// import Backend from "i18next-fs-backend"; // Correct backend import

i18n
  // .use(Backend) // Correct backend usage
  .use(initReactI18next)
  .init({
    lng: "en", // Default language
    fallbackLng: "en",
    debug: true,
    backend: {
      loadPath: "./assets/i18n/{{ns}}/{{lng}}.json", // Ensure the path is correct
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
