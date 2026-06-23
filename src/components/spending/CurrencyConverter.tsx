import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { availableCurrencies, currencySymbols, currencyNames } from "@/lib/currency";
import { useCurrency } from "@/hooks/useCurrency";

export function CurrencyConverter() {
  const { localCurrency, homeCurrency } = useCurrency();
  const { rates, isLoading, error, convert, lastUpdated, refresh } = useExchangeRates();
  
  const [amount, setAmount] = useState("100");
  const [fromCurrency, setFromCurrency] = useState(localCurrency || "USD");
  const [toCurrency, setToCurrency] = useState(homeCurrency || "EUR");
  const [result, setResult] = useState<number | null>(null);

  // Update defaults when currencies change
  useEffect(() => {
    if (localCurrency) setFromCurrency(localCurrency);
  }, [localCurrency]);

  useEffect(() => {
    if (homeCurrency && homeCurrency !== fromCurrency) setToCurrency(homeCurrency);
  }, [homeCurrency, fromCurrency]);

  // Calculate conversion when inputs change
  useEffect(() => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      const converted = convert(numAmount, fromCurrency, toCurrency);
      setResult(converted);
    } else {
      setResult(null);
    }
  }, [amount, fromCurrency, toCurrency, convert]);

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const getSymbol = (code: string) => currencySymbols[code] || code;

  // Filter available currencies to those we have rates for
  const availableForConversion = availableCurrencies.filter(
    (c) => rates[c] !== undefined
  );

  if (error) {
    return (
      <motion.div 
        className="bg-card rounded-xl p-4 border border-border/50"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center text-muted-foreground text-sm">
          <p>Unable to load exchange rates</p>
          <Button variant="ghost" size="sm" onClick={refresh} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="bg-card rounded-xl p-4 border border-border/50 space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Currency Converter</h3>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <button 
            onClick={refresh}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* From Currency */}
        <div className="flex gap-2">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="flex-1 bg-background/50"
          />
          <Select value={fromCurrency} onValueChange={setFromCurrency}>
            <SelectTrigger className="w-28 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableForConversion.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={swapCurrencies}
            className="h-8 w-8 rounded-full"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* To Currency */}
        <div className="flex gap-2">
          <div className="flex-1 bg-muted/50 rounded-md px-3 py-2 flex items-center">
            {isLoading ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : result !== null ? (
              <span className="font-semibold">
                {getSymbol(toCurrency)}{result.toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </span>
            ) : (
              <span className="text-muted-foreground">Enter amount</span>
            )}
          </div>
          <Select value={toCurrency} onValueChange={setToCurrency}>
            <SelectTrigger className="w-28 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableForConversion.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Exchange Rate Info */}
        {!isLoading && result !== null && (
          <p className="text-xs text-muted-foreground text-center">
            1 {fromCurrency} = {getSymbol(toCurrency)}
            {(convert(1, fromCurrency, toCurrency) || 0).toFixed(4)} {toCurrency}
          </p>
        )}
      </div>
    </motion.div>
  );
}