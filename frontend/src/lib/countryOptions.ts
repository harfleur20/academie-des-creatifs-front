import countries from "i18n-iso-countries";
import frLocale from "i18n-iso-countries/langs/fr.json";
import { getCountryCallingCode } from "libphonenumber-js/min";
import type { CountryCode } from "libphonenumber-js";

export type CountryOption = {
  callingCode: string;
  code: string;
  flag: string;
  name: string;
};

countries.registerLocale(frLocale);

function flagFromCountryCode(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function callingCodeFromCountryCode(code: string) {
  try {
    return getCountryCallingCode(code as CountryCode);
  } catch {
    return "";
  }
}

export const COUNTRY_OPTIONS: CountryOption[] = Object.entries(countries.getNames("fr", { select: "official" }))
  .map(([code, name]) => ({
    callingCode: callingCodeFromCountryCode(code),
    code,
    flag: flagFromCountryCode(code),
    name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
