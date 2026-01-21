import { useState, useRef } from "react";
import { Download, FileText, Loader2, PieChart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

interface SpendingRecord {
  id: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string | null;
  location_name: string | null;
  date: string;
  notes: string | null;
}

interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface ExpenseReportDialogProps {
  spending: SpendingRecord[];
  trips?: Trip[];
  trigger?: React.ReactNode;
  getSymbol: (currency: string) => string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(200, 80%, 50%)",
];

export function ExpenseReportDialog({
  spending,
  trips = [],
  trigger,
  getSymbol,
}: ExpenseReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<string>("all");
  const chartRef = useRef<HTMLDivElement>(null);

  const filteredSpending = selectedTrip === "all" 
    ? spending 
    : spending; // For now, show all - trip linking would require spending_records.trip_id

  const categoryTotals = filteredSpending.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + Number(s.amount);
    return acc;
  }, {} as Record<string, number>);

  const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  const primaryCurrency = filteredSpending[0]?.currency || "USD";
  const symbol = getSymbol(primaryCurrency);

  const chartData = Object.entries(categoryTotals).map(([category, amount], index) => ({
    name: category,
    value: amount,
    percentage: ((amount / total) * 100).toFixed(1),
    fill: COLORS[index % COLORS.length],
  }));

  const chartConfig = Object.fromEntries(
    chartData.map((item) => [
      item.name.toLowerCase(),
      { label: item.name, color: item.fill },
    ])
  );

  const dailyTotals = filteredSpending.reduce((acc, s) => {
    acc[s.date] = (acc[s.date] || 0) + Number(s.amount);
    return acc;
  }, {} as Record<string, number>);

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(24);
      doc.setTextColor(59, 130, 246); // Primary blue
      doc.text("Travel Expense Report", pageWidth / 2, 25, { align: "center" });
      
      // Date range
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      const dates = filteredSpending.map(s => s.date).sort();
      const dateRange = dates.length > 0 
        ? `${format(new Date(dates[0]), "MMM d, yyyy")} - ${format(new Date(dates[dates.length - 1]), "MMM d, yyyy")}`
        : "No records";
      doc.text(dateRange, pageWidth / 2, 35, { align: "center" });

      // Total
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total: ${symbol}${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth / 2, 50, { align: "center" });

      // Category Summary Table
      doc.setFontSize(14);
      doc.text("By Category", 14, 65);
      
      autoTable(doc, {
        startY: 70,
        head: [["Category", "Amount", "Percentage"]],
        body: chartData.map(item => [
          item.name,
          `${symbol}${item.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `${item.percentage}%`
        ]),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 10 },
      });

      // Daily Breakdown
      const finalY = (doc as any).lastAutoTable.finalY || 120;
      doc.setFontSize(14);
      doc.text("Daily Breakdown", 14, finalY + 15);

      const dailyData = Object.entries(dailyTotals)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, amount]) => [
          format(new Date(date), "MMM d, yyyy"),
          `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        ]);

      autoTable(doc, {
        startY: finalY + 20,
        head: [["Date", "Amount"]],
        body: dailyData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 10 },
      });

      // Transaction Details (new page if needed)
      doc.addPage();
      doc.setFontSize(14);
      doc.text("All Transactions", 14, 20);

      const transactionData = filteredSpending
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(s => [
          format(new Date(s.date), "MMM d"),
          s.category,
          s.merchant || s.notes || "-",
          `${getSymbol(s.currency)}${Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        ]);

      autoTable(doc, {
        startY: 25,
        head: [["Date", "Category", "Description", "Amount"]],
        body: transactionData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
        columnStyles: {
          2: { cellWidth: 60 },
        },
      });

      // Footer on last page
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "Generated by TravelLens",
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );

      // Save
      doc.save(`expense-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF report downloaded!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            Export Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Expense Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {trips.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Trip</label>
              <Select value={selectedTrip} onValueChange={setSelectedTrip}>
                <SelectTrigger>
                  <SelectValue placeholder="All Spending" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Spending</SelectItem>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview Chart */}
          {chartData.length > 0 ? (
            <div ref={chartRef} className="bg-muted/30 rounded-lg p-4">
              <div className="text-center mb-4">
                <p className="text-2xl font-bold">{symbol}{total.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">
                  {filteredSpending.length} transactions
                </p>
              </div>
              
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      labelLine={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </RechartsPie>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {chartData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span>{item.name}</span>
                    <span className="text-muted-foreground ml-auto">
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <PieChart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No spending data to export</p>
            </div>
          )}

          <Button
            onClick={generatePDF}
            disabled={isGenerating || chartData.length === 0}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PDF Report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
