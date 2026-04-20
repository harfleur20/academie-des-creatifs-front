import {
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import type { Country } from "react-phone-number-input";

import { COUNTRY_OPTIONS, type CountryOption } from "../lib/countryOptions";

type CountryValueMode = "code" | "name";

type CountryComboboxProps = {
  fieldClassName?: string;
  label: string;
  mode?: CountryValueMode;
  onClear?: () => void;
  onSelect: (country: CountryOption) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
};

type PhoneCountrySelectProps = {
  "aria-label"?: string;
  disabled?: boolean;
  name?: string;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  onChange: (country?: Country) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  options: Array<{ divider?: boolean; label: string; value?: Country }>;
  readOnly?: boolean;
  value?: Country;
};

const MAX_COUNTRY_RESULTS = 14;

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function countrySearchValue(country: CountryOption) {
  return `${country.name} ${country.code} ${country.callingCode} +${country.callingCode}`;
}

function countryLabel(country: CountryOption) {
  return `${country.flag} ${country.name}${country.callingCode ? ` (+${country.callingCode})` : ""}`;
}

function filterCountries(countries: CountryOption[], query: string, limit = MAX_COUNTRY_RESULTS) {
  const needle = normalizeSearch(query);
  const filtered = needle
    ? countries.filter((country) => normalizeSearch(countrySearchValue(country)).includes(needle))
    : countries;
  return filtered.slice(0, limit);
}

function findCountry(value: string, mode: CountryValueMode) {
  if (!value) return null;
  return (
    COUNTRY_OPTIONS.find((country) =>
      mode === "code" ? country.code === value : country.name === value,
    ) ?? null
  );
}

export function CountryCombobox({
  fieldClassName = "adm-field",
  label,
  mode = "name",
  onClear,
  onSelect,
  placeholder = "Rechercher un pays",
  required = false,
  value,
}: CountryComboboxProps) {
  const selectedCountry = useMemo(() => findCountry(value, mode), [mode, value]);
  const [query, setQuery] = useState(selectedCountry ? countryLabel(selectedCountry) : value);
  const [isOpen, setIsOpen] = useState(false);
  const filteredCountries = useMemo(() => filterCountries(COUNTRY_OPTIONS, query), [query]);

  useEffect(() => {
    setQuery(selectedCountry ? countryLabel(selectedCountry) : value);
  }, [selectedCountry, value]);

  function selectCountry(country: CountryOption) {
    onSelect(country);
    setQuery(countryLabel(country));
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && filteredCountries[0]) {
      event.preventDefault();
      selectCountry(filteredCountries[0]);
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      setQuery(selectedCountry ? countryLabel(selectedCountry) : value);
    }
  }

  return (
    <label className={fieldClassName}>
      <span>{label}</span>
      <div className="adm-country-combobox">
        <input
          aria-autocomplete="list"
          autoComplete="country-name"
          className="adm-input adm-country-combobox__input"
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
              setQuery(selectedCountry ? countryLabel(selectedCountry) : value);
            }, 120);
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setIsOpen(true);
            if (!nextQuery.trim()) {
              onClear?.();
            }
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          role="combobox"
          type="text"
          value={query}
        />
        {isOpen && (
          <div className="adm-country-combobox__list" role="listbox">
            {filteredCountries.length ? (
              filteredCountries.map((country) => (
                <button
                  className="adm-country-combobox__option"
                  key={country.code}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCountry(country)}
                  role="option"
                  type="button"
                >
                  <span>{country.flag}</span>
                  <strong>{country.name}</strong>
                  {country.callingCode && <small>+{country.callingCode}</small>}
                </button>
              ))
            ) : (
              <p className="adm-country-combobox__empty">Aucun pays trouvé</p>
            )}
          </div>
        )}
      </div>
    </label>
  );
}

export function SearchablePhoneCountrySelect({
  "aria-label": ariaLabel,
  disabled,
  name,
  onBlur,
  onChange,
  onFocus,
  options,
  readOnly,
  value,
}: PhoneCountrySelectProps) {
  const availableCountries = useMemo(() => {
    const allowedCodes = new Set(
      options
        .filter((option) => option.value)
        .map((option) => option.value as string),
    );
    return COUNTRY_OPTIONS.filter((country) => allowedCodes.has(country.code));
  }, [options]);
  const selectedCountry =
    availableCountries.find((country) => country.code === value) ?? null;
  const [query, setQuery] = useState(selectedCountry ? countryLabel(selectedCountry) : "");
  const [isOpen, setIsOpen] = useState(false);
  const filteredCountries = useMemo(
    () => filterCountries(availableCountries, query, 10),
    [availableCountries, query],
  );

  useEffect(() => {
    setQuery(selectedCountry ? countryLabel(selectedCountry) : "");
  }, [selectedCountry]);

  function selectCountry(country: CountryOption) {
    onChange(country.code as Country);
    setQuery(countryLabel(country));
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && filteredCountries[0]) {
      event.preventDefault();
      selectCountry(filteredCountries[0]);
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      setQuery(selectedCountry ? countryLabel(selectedCountry) : "");
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      window.setTimeout(() => {
        setIsOpen(false);
        setQuery(selectedCountry ? countryLabel(selectedCountry) : "");
      }, 120);
      onBlur?.(event);
    }
  }

  return (
    <div className="adm-phone-country" onBlur={handleBlur} onFocus={onFocus}>
      <input
        aria-autocomplete="list"
        aria-label={ariaLabel ?? "Pays du numéro"}
        autoComplete="country-name"
        className="adm-phone-country__input"
        disabled={disabled}
        name={name}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Pays ou indicatif"
        readOnly={readOnly}
        role="combobox"
        type="text"
        value={query}
      />
      {isOpen && !disabled && !readOnly && (
        <div className="adm-phone-country__list" role="listbox">
          {filteredCountries.length ? (
            filteredCountries.map((country) => (
              <button
                className="adm-phone-country__option"
                key={country.code}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCountry(country)}
                role="option"
                type="button"
              >
                <span>{country.flag}</span>
                <strong>{country.name}</strong>
                {country.callingCode && <small>+{country.callingCode}</small>}
              </button>
            ))
          ) : (
            <p className="adm-country-combobox__empty">Aucun pays trouvé</p>
          )}
        </div>
      )}
    </div>
  );
}
