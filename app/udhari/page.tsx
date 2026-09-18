"use client";

import { useMemo, useState, useEffect } from "react";
import { useUdhari, useSales } from "@/hooks/use-supabase";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cleanWholeNumberInput,
  parseWholeNumberInput,
  formatMoney,
  formatPercent,
} from "@/lib/number-format";
import { getCreditPressure } from "@/lib/dukan-insights";
import {
  formatSaleLineSubtitle,
  formatSaleLineQuantity,
} from "@/lib/sale-item-display";
import { SalesItemSearch } from "@/components/sales-item-search";
import {
  Plus,
  Phone,
  ReceiptText,
  WalletCards,
  Edit,
  Trash2,
  X,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";

type EntryMode = "credit" | "payment";

export default function UdhariPage() {
  const { currentShopId, currentShop } = useAuth();
  const {
    customers,
    entries,
    totalPending,
    addCustomer,
    addCredit,
    receivePayment,
    updateCustomer,
    deleteCustomer,
    updateCreditEntry,
    deleteCreditEntry,
    getCustomerEntries,
  } = useUdhari(currentShopId);
  const { sales, updateSale, deleteSale } = useSales(currentShopId);
  const { t } = useLanguage();

  // Function to send WhatsApp reminder
  const sendWhatsAppReminder = (customer: any) => {
    if (!customer.phone) {
      toast.error("Customer has no phone number");
      return;
    }

    // Format phone number: remove any non-digit characters, add country code if needed
    let formattedPhone = customer.phone.replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = "91" + formattedPhone; // Default to India country code
    }
    if (formattedPhone.length === 11 && formattedPhone.startsWith("0")) {
      formattedPhone = "91" + formattedPhone.slice(1);
    }

    const isMarathi = false;
    const customerEntries = getCustomerEntries(customer.id!);

    let message = isMarathi
      ? `नमस्ते ${customer.name}!\n\n`
      : `Hello ${customer.name}!\n\n`;
    message += isMarathi
      ? `आपली बाकीची उधारी: *₹${formatMoney(customer.balance)}*\n\n`
      : `Your pending balance is: *₹${formatMoney(customer.balance)}*\n\n`;

    if (customerEntries.length > 0) {
      message += isMarathi ? `उधारी तपशील:\n` : `Pending details:\n`;
      customerEntries.forEach((entry, index) => {
        const date = new Date(entry.timestamp).toLocaleDateString("en-IN");
        const amountStr =
          entry.type === "credit"
            ? `+₹ ${formatMoney(entry.amount)}`
            : `-₹ ${formatMoney(entry.amount)}`;
        message += `${index + 1}. ${date} - ${
          entry.type === "credit"
            ? isMarathi
              ? "उधारी"
              : "Credit"
            : isMarathi
              ? "पेमेंट"
              : "Payment"
        }: ${amountStr}\n`;

        if (entry.billItems && entry.billItems.length > 0) {
          entry.billItems.forEach((item: any) => {
            message += `   • ${item.itemName} - ${formatSaleLineQuantity(item)}: ₹ ${formatMoney(item.totalPrice)}\n`;
          });
        }

        if (entry.note) {
          message += `   ${isMarathi ? "टीप" : "Note"}: ${entry.note}\n`;
        }
      });
    }

    message += isMarathi
      ? `\nकृपया लवकरच पेमेंट करा.\n\n`
      : `\nPlease pay the pending amount soon.\n\n`;
    if (currentShop?.shopName) {
      message += isMarathi
        ? `धन्यवाद!\n${currentShop.shopName}`
        : `Thanks!\n${currentShop.shopName}`;
    } else {
      message += isMarathi ? `धन्यवाद!` : `Thanks!`;
    }

    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    const opened = window.open(whatsappUrl, "_blank");
    if (opened) {
      toast.success(
        isMarathi ? "WhatsApp स्मरण उघडले" : "WhatsApp reminder opened",
      );
    } else {
      toast.error(
        isMarathi ? "WhatsApp उघडण्यात अडचण आली" : "Unable to open WhatsApp",
      );
    }
  };

  // Dialog states
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editSaleDialogOpen, setEditSaleDialogOpen] = useState(false);
  const [deleteSaleDialogOpen, setDeleteSaleDialogOpen] = useState(false);

  // Current selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  );
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(
    null,
  );
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<number | null>(
    null,
  );
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<number | null>(
    null,
  );
  const [focusedCustomerId, setFocusedCustomerId] = useState<number | null>(
    null,
  );
  const [entryMode, setEntryMode] = useState<EntryMode>("credit");
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);

  // Edit sale dialog state
  const [saleEditItems, setSaleEditItems] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [creditCustomerId, setCreditCustomerId] = useState<number | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [isSaleProcessing, setIsSaleProcessing] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const editingSale = useMemo(
    () => sales.find((s) => s.id === editingSaleId),
    [sales, editingSaleId],
  );

  useEffect(() => {
    if (editingSale) {
      setSaleEditItems(editingSale.items || []);
      setPaymentMethod(editingSale.paymentMethod);
      setCreditCustomerId(editingSale.creditCustomerId || null);
    } else {
      setSaleEditItems([]);
      setPaymentMethod("cash");
      setCreditCustomerId(null);
    }
  }, [editingSale]);

  const handleItemAdded = (item: any) => {
    setSaleEditItems((prev) => [...prev, item]);
    toast.success(`${item.itemName} ${t("success")}`, { id: "sale-item-added" });
  };

  const handleRemoveItem = (index: number) => {
    setSaleEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditItem = (index: number) => {
    setEditingItemIndex(index);
  };

  const handleItemEdited = (newItem: any) => {
    if (editingItemIndex === null) return;
    setSaleEditItems((prev) => {
      const updatedItems = [...prev];
      updatedItems[editingItemIndex] = newItem;
      return updatedItems;
    });
    setEditingItemIndex(null);
  };

  const handlePaymentChange = (value: string) => {
    const nextPaymentMethod = value;
    setPaymentMethod(nextPaymentMethod);
    if (nextPaymentMethod !== "udhar") {
      setCreditCustomerId(null);
      setNewCustomerName("");
      setNewCustomerPhone("");
    }
  };

  const handleUpdateSale = async () => {
    if (!editingSaleId || saleEditItems.length === 0) {
      toast.error(t("error"));
      return;
    }
    setIsSaleProcessing(true);
    try {
      const totals = {
        subtotal: saleEditItems.reduce(
          (sum, item) => sum + (item.totalPrice || 0),
          0,
        ),
        totalCost: saleEditItems.reduce(
          (sum, item) => sum + (item.totalCost || 0),
          0,
        ),
      };
      const totalProfit = totals.subtotal - totals.totalCost;
      const profitMarginPercent =
        totals.subtotal > 0 ? (totalProfit / totals.subtotal) * 100 : 0;
      await updateSale(editingSaleId, {
        date: editingSale.date,
        timestamp: editingSale.timestamp,
        items: saleEditItems,
        totalQuantityItems: saleEditItems.length,
        subtotal: totals.subtotal,
        totalCost: totals.totalCost,
        totalProfit,
        profitMarginPercent,
        paymentMethod,
        creditCustomerId:
          paymentMethod === "udhar" ? creditCustomerId : undefined,
        creditCustomerName:
          paymentMethod === "udhar"
            ? customers.find((c) => c.id === creditCustomerId)?.name ||
              newCustomerName
            : undefined,
      });
      toast.success("Sale updated successfully");
      setEditSaleDialogOpen(false);
      setEditingSaleId(null);
    } catch (error) {
      console.error("Error updating sale", error);
      toast.error(t("error"));
    } finally {
      setIsSaleProcessing(false);
    }
  };

  const handleDeleteSale = async () => {
    if (!deletingSaleId) return;
    try {
      await deleteSale(deletingSaleId);
      toast.success("Sale deleted successfully");
      setDeleteSaleDialogOpen(false);
      setDeletingSaleId(null);
    } catch (error) {
      console.error("Error deleting sale", error);
      toast.error(t("error"));
    }
  };

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );
  const editingCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === editingCustomerId) || null,
    [customers, editingCustomerId],
  );
  const editingEntry = useMemo(
    () => entries.find((entry) => entry.id === editingEntryId) || null,
    [entries, editingEntryId],
  );
  const recentEntries = entries.slice(0, 4);

  const sortedCustomers = useMemo(() => {
    const query = customerSearch.trim().toLocaleLowerCase();
    return [...customers]
      .filter(
        (customer) =>
          !query ||
          customer.name.toLocaleLowerCase().includes(query) ||
          String(customer.phone || "").includes(query),
      )
      .sort((first, second) => {
        const firstHasBalance = Number(first.balance > 0);
        const secondHasBalance = Number(second.balance > 0);
        return secondHasBalance - firstHasBalance || Number(second.balance) - Number(first.balance);
      });
  }, [customers, customerSearch]);
  const highestPendingCustomer = useMemo(
    () => [...customers].sort((first, second) => Number(second.balance) - Number(first.balance))[0],
    [customers],
  );
  const needsPaymentSoonCount = customers.filter((customer) => {
    if (customer.balance <= 0) return false;
    const pressure = getCreditPressure(
      customer.id,
      Number(customer.balance || 0),
      entries,
    );
    return pressure.riskLevel === "recover" || pressure.riskLevel === "high";
  }).length;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerId = Number(params.get("focusCustomerId"));

    if (Number.isFinite(customerId) && customerId > 0) {
      setFocusedCustomerId(customerId);
    }
  }, []);

  useEffect(() => {
    if (!focusedCustomerId) return;
    if (!customers.some((customer) => customer.id === focusedCustomerId))
      return;

    setExpandedCustomerId(focusedCustomerId);

    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(`udhari-customer-${focusedCustomerId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    const clearTimer = window.setTimeout(
      () => setFocusedCustomerId(null),
      5000,
    );

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [customers, focusedCustomerId]);

  const resetCustomerForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerDialogOpen(false);
    setEditingCustomerId(null);
  };

  const resetEntryForm = () => {
    setAmount("");
    setNote("");
    setEntryDialogOpen(false);
    setSelectedCustomerId(null);
    setEditingEntryId(null);
    setEntryMode("credit");
  };

  const openAddCustomerDialog = () => {
    setEditingCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerDialogOpen(true);
  };

  const openEditCustomerDialog = (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    setEditingCustomerId(customerId);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || "");
    setCustomerDialogOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!customerName.trim()) {
      toast.error(t("customer_name"));
      return;
    }

    if (editingCustomerId) {
      await updateCustomer(editingCustomerId, {
        name: customerName.trim(),
        phone: customerPhone.trim() || undefined,
      });
      toast.success("Customer updated");
    } else {
      await addCustomer({
        name: customerName.trim(),
        phone: customerPhone.trim() || undefined,
      });
      toast.success(t("success"));
    }
    resetCustomerForm();
  };

  const openEntryDialog = (customerId: number, mode: EntryMode) => {
    setEditingEntryId(null);
    setSelectedCustomerId(customerId);
    setEntryMode(mode);
    setAmount("");
    setNote("");
    setEntryDialogOpen(true);
  };

  const openEditEntryDialog = (entry: any) => {
    setEditingEntryId(entry.id);
    setSelectedCustomerId(entry.customerId);
    setEntryMode(entry.type);
    setAmount(String(entry.amount));
    setNote(entry.note || "");
    setEntryDialogOpen(true);
  };

  const handleSaveEntry = async () => {
    const value = parseWholeNumberInput(amount);

    if (!selectedCustomer || !Number.isFinite(value) || value <= 0) {
      toast.error(t("error"));
      return;
    }

    if (editingEntryId) {
      await updateCreditEntry(editingEntryId, {
        amount: value,
        type: entryMode,
        note: note.trim() || undefined,
      });
      toast.success("Entry updated");
    } else {
      if (entryMode === "payment" && value > selectedCustomer.balance) {
        toast.error(t("error"));
        return;
      }

      if (entryMode === "credit") {
        await addCredit(selectedCustomer.id!, value, note.trim() || undefined);
        toast.success(
          (`₹${formatMoney(value)} udhari added`),
        );
      } else {
        const willClearBalance = value >= selectedCustomer.balance;
        await receivePayment(
          selectedCustomer.id!,
          value,
          note.trim() || undefined,
        );
        toast.success(
          willClearBalance
            ? ("🎉 Udhari fully recovered")
            : (`✅ ${selectedCustomer.name} paid ₹${formatMoney(value)}`),
          {
            description: willClearBalance
              ? selectedCustomer.name
              : (`₹${formatMoney(selectedCustomer.balance - value)} remaining`),
          },
        );
      }
    }

    resetEntryForm();
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntryId) return;
    try {
      await deleteCreditEntry(deletingEntryId);
      toast.success("Entry deleted");
      setDeletingEntryId(null);
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry");
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomerId) return;
    try {
      await deleteCustomer(deletingCustomerId);
      toast.success("Customer deleted");
      setDeletingCustomerId(null);
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Cannot delete customer with outstanding balance");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 text-stone-900 sm:pb-10">
      <div className="relative overflow-hidden rounded-[2rem] border border-orange-800/10 bg-gradient-to-br from-orange-500 via-amber-500 to-amber-400 p-5 text-white shadow-[0_18px_45px_rgba(217,119,6,0.18)] sm:p-7">
        <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/15" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-50">Customer credit</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Udhari</h1>
            <p className="mt-1 text-sm text-orange-50">Track medicine credit and collect payments on time</p>
          </div>
          <Button onClick={openAddCustomerDialog} className="h-11 gap-2 rounded-full bg-white px-5 font-bold text-orange-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-50 active:scale-95">
            <Plus className="h-4 w-4" />
            {t("add_customer")}
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-orange-200/80 bg-gradient-to-br from-orange-50 to-white p-5 shadow-[0_8px_22px_rgba(249,115,22,0.08)] sm:p-6">
        <p className="text-sm font-semibold text-orange-800">
          {("Total pending")}
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-orange-950 sm:text-5xl">
          ₹{formatMoney(totalPending)}
        </p>
        <p className="mt-2 text-sm text-orange-800">
          {(`${customers.length} customers • ${needsPaymentSoonCount} need payment soon`)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 sm:p-4">
          <p className="text-xs font-medium text-blue-700">Customers</p>
          <p className="mt-1 text-2xl font-bold text-blue-950">{customers.length}</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-3 sm:p-4">
          <p className="text-xs font-medium text-red-700">Follow up</p>
          <p className="mt-1 text-2xl font-bold text-red-900">{needsPaymentSoonCount}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-amber-100 bg-amber-50 p-3 sm:p-4">
          <p className="truncate text-xs font-medium text-amber-700">Highest balance</p>
          <p className="mt-1 truncate text-lg font-bold text-amber-950">₹{formatMoney(highestPendingCustomer?.balance || 0)}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={customerSearch}
          onChange={(event) => setCustomerSearch(event.target.value)}
          placeholder="Search customers by name or phone"
          className="h-12 rounded-2xl border-stone-200 bg-white pl-10 shadow-sm focus-visible:border-teal-500 focus-visible:ring-teal-100"
        />
      </div>

      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold tracking-tight">{t("customers")}</h2><p className="text-xs text-stone-500">{sortedCustomers.length} customer records</p></div>
        <Clock3 className="h-5 w-5 text-orange-500" />
      </div>

      {sortedCustomers.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-stone-300 shadow-sm">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {customerSearch ? "No customers match your search" : t("no_udhari_customers")}
            </p>
            {!customerSearch && <Button onClick={openAddCustomerDialog} className="mt-4 gap-2 bg-teal-700 hover:bg-teal-800">
              <Plus className="h-4 w-4" />
              {t("add_customer")}
            </Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 [content-visibility:auto] [contain-intrinsic-size:auto_720px]">
          {sortedCustomers.map((customer) => {
            const customerEntries = getCustomerEntries(customer.id!).slice(
              0,
              6,
            );
            const isExpanded = expandedCustomerId === customer.id;
            const creditPressure = getCreditPressure(
              customer.id,
              Number(customer.balance || 0),
              entries,
            );
            const pendingAgeText =
              customer.balance <= 0
                ? ("Udhari complete")
                : (`Pending for ${creditPressure.daysPending} days`);

            return (
              <Card
                key={customer.id}
                id={`udhari-customer-${customer.id}`}
                className={`overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-[0_5px_20px_rgba(28,49,43,0.05)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_12px_28px_rgba(249,115,22,0.10)] ${
                  focusedCustomerId === customer.id
                    ? "border-orange-400 bg-orange-50 ring-2 ring-orange-200"
                    : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold tracking-tight">
                        {customer.name}
                      </h2>
                      {customer.phone && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {customer.phone}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold tabular-nums text-orange-700">
                        ₹{formatMoney(customer.balance)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 text-sm font-semibold text-muted-foreground">
                    {pendingAgeText}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => openEntryDialog(customer.id!, "credit")}
                      className="h-11 rounded-xl bg-orange-500 text-sm font-semibold hover:bg-orange-600"
                    >
                      {("Add Udhari")}
                    </Button>
                    <Button
                      onClick={() => openEntryDialog(customer.id!, "payment")}
                      className="h-11 rounded-xl bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800"
                      disabled={customer.balance <= 0}
                    >
                      {("Receive Payment")}
                    </Button>
                  </div>
                  {/* WhatsApp Reminder Button */}
                  {customer.balance > 0 && (
                    <Button
                      onClick={() => sendWhatsAppReminder(customer)}
                      variant="default"
                      className="mt-2 h-10 w-full gap-2 rounded-xl bg-emerald-600 text-xs font-semibold hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {("WhatsApp reminder")}
                    </Button>
                  )}

                  <div className="mt-3 border-t border-border/70">
                    <Button
                      onClick={() =>
                        setExpandedCustomerId(isExpanded ? null : customer.id!)
                      }
                      variant="ghost"
                      className="h-10 w-full justify-between rounded-none px-1 text-sm font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground"
                    >
                      <span>
                        {("View history")}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="mt-2 flex justify-end gap-2 border-t pt-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-blue-600"
                      onClick={() => openEditCustomerDialog(customer.id!)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600"
                      onClick={() => setDeletingCustomerId(customer.id!)}
                      disabled={customer.balance > 0}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-2 border-t pt-3">
                      {customerEntries.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("no_history")}
                        </p>
                      ) : (
                        customerEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-md bg-muted/50 px-3 py-2 text-xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold">
                                    {entry.saleId
                                      ? `${t("sale_bill")} #${entry.saleId}`
                                      : entry.type === "credit"
                                        ? t("udhari")
                                        : t("payment")}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-blue-600"
                                      onClick={() => {
                                        if (entry.saleId) {
                                          setEditingSaleId(entry.saleId);
                                          setEditSaleDialogOpen(true);
                                        } else {
                                          openEditEntryDialog(entry);
                                        }
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-red-600"
                                      onClick={() => {
                                        if (entry.saleId) {
                                          setDeletingSaleId(entry.saleId);
                                          setDeleteSaleDialogOpen(true);
                                        } else {
                                          setDeletingEntryId(entry.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-muted-foreground">
                                  {new Date(entry.timestamp).toLocaleDateString(
                                    "en-IN",
                                  )}
                                  {entry.note ? ` - ${entry.note}` : ""}
                                </p>
                              </div>
                              <p
                                className={
                                  entry.type === "credit"
                                    ? "font-bold text-orange-700"
                                    : "font-bold text-green-700"
                                }
                              >
                                {entry.type === "credit" ? "+" : "-"} Rs.{" "}
                                {formatMoney(entry.amount)}
                              </p>
                            </div>
                            {entry.billItems && entry.billItems.length > 0 && (
                              <div className="mt-2 space-y-1 border-t pt-2">
                                {entry.billItems.map(
                                  (item: any, itemIndex: number) => (
                                    <div
                                      key={`${entry.id}-${item.itemName}-${itemIndex}`}
                                      className="flex justify-between gap-2"
                                    >
                                      <span className="min-w-0 truncate">
                                        {item.itemName} -{" "}
                                        {formatSaleLineQuantity(item)}
                                      </span>
                                      <span className="font-semibold">
                                        Rs. {formatMoney(item.totalPrice)}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {recentEntries.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="h-4 w-4" />
              {t("recent")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border bg-muted/40 px-3 py-2 text-sm shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold">{entry.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.saleId
                        ? `${t("sale_bill")} #${entry.saleId}`
                        : entry.type === "credit"
                          ? t("udhari")
                          : t("payment")}{" "}
                      - {new Date(entry.timestamp).toLocaleDateString("en-IN")}
                      {entry.note ? ` - ${entry.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-blue-600"
                      onClick={() => {
                        if (entry.saleId) {
                          setEditingSaleId(entry.saleId);
                          setEditSaleDialogOpen(true);
                        } else {
                          openEditEntryDialog(entry);
                        }
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-600"
                      onClick={() => {
                        if (entry.saleId) {
                          setDeletingSaleId(entry.saleId);
                          setDeleteSaleDialogOpen(true);
                        } else {
                          setDeletingEntryId(entry.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <p
                      className={
                        entry.type === "credit"
                          ? "font-bold text-orange-700"
                          : "font-bold text-green-700"
                      }
                    >
                      {entry.type === "credit" ? "+" : "-"} Rs.{" "}
                      {formatMoney(entry.amount)}
                    </p>
                  </div>
                </div>
                {entry.billItems && entry.billItems.length > 0 && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    {entry.billItems.map((item: any, itemIndex: number) => (
                      <div
                        key={`${entry.id}-${item.itemName}-${itemIndex}`}
                        className="flex justify-between gap-2"
                      >
                        <span className="min-w-0 truncate">
                          {item.itemName} - {formatSaleLineQuantity(item)}
                        </span>
                        <span className="font-semibold">
                          Rs. {formatMoney(item.totalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCustomer
                ? `${t("edit")} ${t("customer")}`
                : t("add_customer")}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? `${t("edit_customer_details")} ${editingCustomer.name}`
                : t("name_is_enough")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder={t("customer_name")}
            />
            <Input
              value={customerPhone}
              onChange={(event) =>
                setCustomerPhone(cleanWholeNumberInput(event.target.value))
              }
              placeholder={t("mobile_number")}
              inputMode="tel"
            />
            <div className="flex gap-2">
              <Button
                onClick={resetCustomerForm}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleSaveCustomer} className="flex-1">
                {editingCustomerId ? "Save Changes" : t("save_customer")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntry
                ? `${t("edit")} ${editingEntry.type === "credit" ? t("udhari") : t("payment")}`
                : entryMode === "credit"
                  ? `${t("add")} ${t("udhari")}`
                  : t("receive_payment")}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? `${t("editing_entry_for")} ${selectedCustomer?.name || editingEntry.customerName}`
                : selectedCustomer?.name || t("select_customer_for_entry")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <WalletCards className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={amount}
                onChange={(event) =>
                  setAmount(cleanWholeNumberInput(event.target.value))
                }
                placeholder={t("amount")}
                inputMode="numeric"
                pattern="[0-9]*"
                className="pl-10"
              />
            </div>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("note")}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={resetEntryForm}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEntry} className="flex-1">
                {editingEntryId
                  ? "Save Changes"
                  : entryMode === "credit"
                    ? `${t("add")} ${t("udhari")}`
                    : t("save_payment")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingCustomerId}
        onOpenChange={(open) => !open && setDeletingCustomerId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this customer?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Only customers with zero balance can
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCustomer}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deletingEntryId}
        onOpenChange={(open) => !open && setDeletingEntryId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this entry?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update the customer's balance accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Sale Dialog */}
      <Dialog
        open={editSaleDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditSaleDialogOpen(false);
            setEditingSaleId(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
          </DialogHeader>
          {editingSale && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("add_items")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editingItemIndex !== null && (
                      <Button
                        variant="outline"
                        className="mb-2 w-full"
                        onClick={() => setEditingItemIndex(null)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel Edit Item
                      </Button>
                    )}
                    <SalesItemSearch
                      onItemAdded={handleItemAdded}
                      addedItems={saleEditItems}
                      itemToEdit={
                        editingItemIndex !== null
                          ? saleEditItems[editingItemIndex]
                          : undefined
                      }
                      onItemEdited={handleItemEdited}
                    />
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-3 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("sale_items")} ({saleEditItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {saleEditItems.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        <p>{t("no_items_added")}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {saleEditItems.map((item, index) => {
                          const profit = item.totalPrice - item.totalCost;
                          const marginPct =
                            item.totalPrice > 0
                              ? (profit / item.totalPrice) * 100
                              : 0;
                          return (
                            <div
                              key={`${item.itemId}-${index}`}
                              className="flex items-start justify-between rounded border bg-gray-50 p-3 transition hover:bg-gray-100"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold">
                                  {item.itemName} - {item.displayQuantity}
                                </div>
                                <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                  <div>
                                    {t("selling")}:{" "}
                                    {formatSaleLineSubtitle(item)} ={" "}
                                    <span className="font-semibold text-blue-600">
                                      Rs. {formatMoney(item.totalPrice)}
                                    </span>
                                  </div>
                                  <div>
                                    {t("cost")}: Rs.{" "}
                                    {formatMoney(item.totalCost)}
                                  </div>
                                </div>
                                <div className="mt-1 text-xs font-semibold">
                                  <span
                                    className={
                                      profit > 0
                                        ? "text-green-700"
                                        : "text-red-700"
                                    }
                                  >
                                    {t("profit_amount")}: Rs.{" "}
                                    {formatMoney(profit)} (
                                    {formatPercent(marginPct)}%)
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEditItem(index)}
                                  className="flex-shrink-0 text-blue-600 hover:text-blue-800"
                                  aria-label={`Edit ${item.itemName}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleRemoveItem(index)}
                                  className="flex-shrink-0 text-red-600 hover:text-red-800"
                                  aria-label={`Remove ${item.itemName}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {saleEditItems.length > 0 && (
                  <>
                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="pt-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>{t("total_revenue")}:</span>
                            <span className="font-bold">
                              Rs.{" "}
                              {formatMoney(
                                saleEditItems.reduce(
                                  (sum, item) => sum + item.totalPrice,
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t("total_cost")}:</span>
                            <span className="font-bold">
                              Rs.{" "}
                              {formatMoney(
                                saleEditItems.reduce(
                                  (sum, item) => sum + item.totalCost,
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="font-bold">{t("profit")}:</span>
                            <span className="font-bold text-green-700">
                              Rs.{" "}
                              {formatMoney(
                                saleEditItems.reduce(
                                  (sum, item) =>
                                    sum + (item.totalPrice - item.totalCost),
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {t("payment_method")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Select
                          value={paymentMethod}
                          onValueChange={handlePaymentChange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">{t("cash")}</SelectItem>
                            <SelectItem value="card">{t("card")}</SelectItem>
                            <SelectItem value="udhar">{t("udhari")}</SelectItem>
                          </SelectContent>
                        </Select>
                        {paymentMethod === "udhar" && (
                          <div className="space-y-3">
                            {customers.length > 0 ? (
                              <Select
                                value={String(creditCustomerId || "")}
                                onValueChange={(val) =>
                                  setCreditCustomerId(Number(val))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("select_customer")}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {customers.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : null}
                            {!creditCustomerId && (
                              <div className="space-y-2">
                                <Input
                                  placeholder={t("customer_name")}
                                  value={newCustomerName}
                                  onChange={(e) =>
                                    setNewCustomerName(e.target.value)
                                  }
                                />
                                <Input
                                  placeholder={t("mobile_number")}
                                  value={newCustomerPhone}
                                  onChange={(e) =>
                                    setNewCustomerPhone(
                                      cleanWholeNumberInput(e.target.value),
                                    )
                                  }
                                  inputMode="tel"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditSaleDialogOpen(false);
                          setEditingSaleId(null);
                        }}
                        className="flex-1"
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        onClick={handleUpdateSale}
                        disabled={isSaleProcessing}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        {t("save")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Sale Alert Dialog */}
      <AlertDialog
        open={deleteSaleDialogOpen}
        onOpenChange={(open) => !open && setDeletingSaleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this sale?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will delete the sale, update stock, and adjust
              customer balance if necessary. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSale}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
