// Country code to currency code mapping
export const countryCurrencyMap: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  EU: "EUR",
  JP: "JPY",
  CN: "CNY",
  KR: "KRW",
  IN: "INR",
  AU: "AUD",
  CA: "CAD",
  CH: "CHF",
  HK: "HKD",
  SG: "SGD",
  TH: "THB",
  VN: "VND",
  PH: "PHP",
  MY: "MYR",
  ID: "IDR",
  TW: "TWD",
  NZ: "NZD",
  MX: "MXN",
  BR: "BRL",
  ZA: "ZAR",
  AE: "AED",
  SA: "SAR",
  RU: "RUB",
  TR: "TRY",
  PL: "PLN",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  CZ: "CZK",
  HU: "HUF",
  // European countries using EUR
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
};

// Currency symbols
export const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF",
  HKD: "HK$",
  SGD: "S$",
  THB: "฿",
  VND: "₫",
  PHP: "₱",
  MYR: "RM",
  IDR: "Rp",
  TWD: "NT$",
  NZD: "NZ$",
  MXN: "MX$",
  BRL: "R$",
  ZAR: "R",
  AED: "د.إ",
  SAR: "﷼",
  RUB: "₽",
  TRY: "₺",
  PLN: "zł",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  CZK: "Kč",
  HUF: "Ft",
};

// Currency names for display
export const currencyNames: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  CNY: "Chinese Yuan",
  KRW: "South Korean Won",
  INR: "Indian Rupee",
  AUD: "Australian Dollar",
  CAD: "Canadian Dollar",
  CHF: "Swiss Franc",
  HKD: "Hong Kong Dollar",
  SGD: "Singapore Dollar",
  THB: "Thai Baht",
  VND: "Vietnamese Dong",
  PHP: "Philippine Peso",
  MYR: "Malaysian Ringgit",
  IDR: "Indonesian Rupiah",
  TWD: "Taiwan Dollar",
  NZD: "New Zealand Dollar",
  MXN: "Mexican Peso",
  BRL: "Brazilian Real",
  ZAR: "South African Rand",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
  RUB: "Russian Ruble",
  TRY: "Turkish Lira",
  PLN: "Polish Zloty",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  CZK: "Czech Koruna",
  HUF: "Hungarian Forint",
};

// Get all available currencies
export const availableCurrencies = Object.keys(currencyNames);

// Get currency code from country code
export function getCurrencyFromCountry(countryCode: string): string {
  return countryCurrencyMap[countryCode.toUpperCase()] || "USD";
}

// Format currency amount
export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = currencySymbols[currencyCode] || currencyCode;
  
  // Currencies without decimals
  const noDecimalCurrencies = ["JPY", "KRW", "VND", "IDR", "HUF"];
  
  if (noDecimalCurrencies.includes(currencyCode)) {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
  
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Get currency display name with symbol
export function getCurrencyDisplay(currencyCode: string): string {
  const name = currencyNames[currencyCode] || currencyCode;
  const symbol = currencySymbols[currencyCode] || "";
  return `${currencyCode} (${symbol}) - ${name}`;
}
