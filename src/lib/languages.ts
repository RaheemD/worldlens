// Supported languages for translation
export const languages = [
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "tl", name: "Filipino", native: "Filipino" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "no", name: "Norwegian", native: "Norsk" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "he", name: "Hebrew", native: "עברית" },
];

// Country code to default language mapping
export const countryLanguageMap: Record<string, string> = {
  US: "en",
  GB: "en",
  AU: "en",
  CA: "en",
  NZ: "en",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  FR: "fr",
  BE: "fr",
  CH: "fr",
  DE: "de",
  AT: "de",
  IT: "it",
  PT: "pt",
  BR: "pt",
  NL: "nl",
  RU: "ru",
  JP: "ja",
  KR: "ko",
  CN: "zh",
  TW: "zh",
  HK: "zh",
  SA: "ar",
  AE: "ar",
  EG: "ar",
  IN: "hi",
  TH: "th",
  VN: "vi",
  ID: "id",
  MY: "ms",
  PH: "tl",
  TR: "tr",
  PL: "pl",
  UA: "uk",
  CZ: "cs",
  SE: "sv",
  DK: "da",
  NO: "no",
  FI: "fi",
  GR: "el",
  IL: "he",
};

export function getLanguageFromCountry(countryCode: string): string {
  return countryLanguageMap[countryCode.toUpperCase()] || "en";
}

export function getLanguageName(code: string): string {
  const lang = languages.find((l) => l.code === code);
  return lang?.name || code;
}

export function getLanguageNative(code: string): string {
  const lang = languages.find((l) => l.code === code);
  return lang?.native || code;
}
