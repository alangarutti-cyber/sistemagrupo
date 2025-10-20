import React, { useEffect, useMemo, useState, useCallback } from "react";
    import { supabase } from "@/lib/customSupabaseClient";
    import { Button } from "@/components/ui/button";
    import { useToast } from "@/components/ui/use-toast";
    import { motion } from "framer-motion";
    import { FileDown, Printer, Filter, ArrowLeft, ArrowRight, UserCheck as UserSearch } from 'lucide-react';
    import * as XLSX from "xlsx";
    import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
    import { ptBR } from "date-fns/locale";
    import { useUser } from "@/contexts/UserContext";
    import { Skeleton } from "@/components/ui/skeleton";
    import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { cn } from "@/lib/utils";
    import { Check } from 'lucide-react';
    
    const PagamentoSemanal = () => {
      const { user, companies } = useUser();
      const { toast } = useToast();
      const [payments, setPayments] = useState([]);
      const [employees, setEmployees] = useState([]);
      const [loading, setLoading] = useState(false);
      const [selectedCompanyId, setSelectedCompanyId] = useState("all");
      const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
      const [selectedSector, setSelectedSector] = useState("all");
      const [openEmployeePopover, setOpenEmployeePopover] = useState(false);
    
      const [currentDate, setCurrentDate] = useState(new Date());
    
      const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);
      const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);
    
      const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        const userCompanyIds = user.company_ids?.map(c => c.company_id) || [];
        return user.is_admin
          ? companies
          : companies.filter((c) => userCompanyIds.includes(c.id));
      }, [user, companies]);
    
      const fetchEmployees = useCallback(async () => {
        if (allowedCompanies.length === 0) {
            setEmployees([]);
            return;
        }
    
        let query = supabase.from("employees").select("*");
    
        if(selectedCompanyId !== 'all') {
            query = query.eq('company_id', selectedCompanyId);
        } else {
            const allowedCompanyIds = allowedCompanies.map(c => c.id);
            query = query.in('company_id', allowedCompanyIds);
        }
    
        const { data, error } = await query;
        if (error) {
          console.error("Error fetching employees:", error);
        } else {
          setEmployees(data || []);
        }
      }, [selectedCompanyId, allowedCompanies]);
    
      useEffect(() => {
        fetchEmployees();
      }, [fetchEmployees]);
    
    
      const fetchPayments = useCallback(async () => {
        if (allowedCompanies.length === 0) {
          setPayments([]);
          return;
        }
        setLoading(true);
        try {
          let query = supabase
            .from("weekly_payments")
            .select("*, employee:employees(*), items:weekly_payment_items(*, source:employee_payments(*))")
            .eq("week_start_date", format(weekStart, 'yyyy-MM-dd'))
            .gt('total_value', 0);
    
          if (selectedCompanyId !== "all") {
            query = query.eq('company_id', selectedCompanyId);
          } else {
            const allowedCompanyIds = allowedCompanies.map(c => c.id);
            query = query.in('company_id', allowedCompanyIds);
          }
    
          if (selectedEmployeeId !== "all") {
            query = query.eq('employee_id', selectedEmployeeId);
          }

          if (selectedSector !== "all") {
            query = query.eq('employee.setor', selectedSector);
          }
    
          const { data, error } = await query;
          if (error) throw error;
          setPayments(data || []);
        } catch (error) {
          console.error("Error fetching weekly payments:", error);
          toast({
            title: "Erro ao carregar pagamentos",
            description: error.message || "Ocorreu um erro.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }, [weekStart, selectedCompanyId, selectedEmployeeId, selectedSector, allowedCompanies, toast]);
    
      useEffect(() => {
        fetchPayments();
      }, [fetchPayments]);
    
      const handleNextWeek = () => {
        setCurrentDate((prev) => addWeeks(prev, 1));
      };
    
      const handlePrevWeek = () => {
        setCurrentDate((prev) => subWeeks(prev, 1));
      };
    
      const groupedPayments = useMemo(() => {
        return payments.reduce((acc, payment) => {
          const companyId = payment.company_id;
          if (!acc[companyId]) {
            acc[companyId] = [];
          }
          acc[companyId].push(payment);
          return acc;
        }, {});
      }, [payments]);
    
      const totalPendente = useMemo(() => payments.filter(p => p.status !== 'pago').reduce((sum, p) => sum + p.total_value, 0), [payments]);
      const totalPago = useMemo(() => payments.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.total_value, 0), [payments]);
      const totalGeral = useMemo(() => payments.reduce((sum, p) => sum + p.total_value, 0), [payments]);
    
      const handlePrint = () => window.print();
    
      const handleExport = () => {
        const rows = payments.map(p => {
          const company = companies.find(c => c.id === p.company_id);
          return {
            'Empresa': company?.name || 'N/A',
            'Funcionário': p.employee?.name || 'N/A',
            'Valor Total': p.total_value,
            'Status': p.status,
            'Início da Semana': format(new Date(p.week_start_date), "dd/MM/yyyy"),
          };
        });
    
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Pagamentos Semanais");
        XLSX.writeFile(wb, `pagamentos_semanais_${format(weekStart, 'yyyy-MM-dd')}.xlsx`);
      };
    
      const getDeliveryCount = (payment) => {
        if (!payment.items) return 0;
        return payment.items.reduce((totalUnits, item) => {
          if (item.source) {
            return totalUnits + (item.source.units || 0);
          }
          return totalUnits;
        }, 0);
      };

      const availableSectors = useMemo(() => {
        const staticSectors = ["Motoboy", "Freelancers", "Salão", "Delivery"];
        const dynamicSectors = employees.map(e => e.setor).filter(Boolean);
        const uniqueDynamicSectors = Array.from(new Set(dynamicSectors));
        const combinedSectors = [...new Set([...staticSectors, ...uniqueDynamicSectors])];
        return combinedSectors;
      }, [employees]);
    
      return (
        <div className="p-4 md:p-6 space-y-6">
          <h1 className="text-2xl font-bold text-center">Pagamento Semanal</h1>
    
          <div className="sticky top-0 bg-background z-10 py-3 shadow-sm rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <motion.div className="p-4 bg-card rounded-xl shadow-md" whileHover={{ scale: 1.02 }}>
                <p className="text-muted-foreground font-medium">Total da Semana</p>
                <h2 className="text-2xl font-bold text-primary">
                  {totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </h2>
              </motion.div>
              <motion.div className="p-4 bg-card rounded-xl shadow-md" whileHover={{ scale: 1.02 }}>
                <p className="text-muted-foreground font-medium">Total Pago</p>
                <h2 className="text-2xl font-bold text-green-600">
                  {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </h2>
              </motion.div>
              <motion.div className="p-4 bg-card rounded-xl shadow-md" whileHover={{ scale: 1.02 }}>
                <p className="text-muted-foreground font-medium">Pendente</p>
                <h2 className="text-2xl font-bold text-yellow-600">
                  {totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </h2>
              </motion.div>
            </div>
          </div>
    
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card rounded-xl p-4 shadow-md">
            <div className="flex items-center gap-2">
              <Button onClick={handlePrevWeek} variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Anterior</span>
              </Button>
              <span className="font-medium text-center">
                {format(weekStart, "dd/MM")} a {format(weekEnd, "dd/MM/yyyy")}
              </span>
              <Button onClick={handleNextWeek} variant="outline" size="sm">
                <span className="hidden md:inline">Próxima</span> <ArrowRight className="w-4 h-4 md:ml-1" />
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center border rounded-lg p-1 bg-background">
                <Filter className="w-4 h-4 text-muted-foreground mr-1" />
                <select
                  className="bg-transparent outline-none text-sm"
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedEmployeeId("all");
                    setSelectedSector("all");
                  }}
                >
                  <option value="all">Todas as Empresas</option>
                  {allowedCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

               <div className="flex items-center border rounded-lg p-1 bg-background">
                <Filter className="w-4 h-4 text-muted-foreground mr-1" />
                <select
                  className="bg-transparent outline-none text-sm"
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                >
                  <option value="all">Todos os Setores</option>
                  {availableSectors.map((sector) => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              </div>
    
              <Popover open={openEmployeePopover} onOpenChange={setOpenEmployeePopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openEmployeePopover}
                    className="w-[200px] justify-between"
                  >
                    {selectedEmployeeId !== "all"
                      ? employees.find((employee) => employee.id === selectedEmployeeId)?.name
                      : "Selecione Funcionário"}
                    <UserSearch className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar funcionário..." />
                    <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                    <CommandGroup>
                       <CommandItem
                          key="all"
                          value="all"
                          onSelect={() => {
                            setSelectedEmployeeId("all");
                            setOpenEmployeePopover(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedEmployeeId === "all" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Todos os Funcionários
                        </CommandItem>
                      {employees.map((employee) => (
                        <CommandItem
                          key={employee.id}
                          value={employee.name}
                          onSelect={() => {
                            setSelectedEmployeeId(employee.id);
                            setOpenEmployeePopover(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedEmployeeId === employee.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {employee.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
    
              <Button onClick={handlePrint} variant="ghost" size="icon" className="hidden md:inline-flex">
                <Printer className="w-4 h-4" />
              </Button>
              <Button onClick={handleExport} variant="ghost" size="icon">
                <FileDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
    
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-card p-4 rounded-xl shadow space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ))}
            </div>
          ) : Object.keys(groupedPayments).length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">Nenhum pagamento encontrado para esta semana.</p>
            </div>
          ) : (
            Object.entries(groupedPayments).map(([companyId, paymentList]) => {
              const company = companies.find((c) => c.id === parseInt(companyId));
              return (
                <motion.div
                  key={companyId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card shadow-lg p-4 rounded-xl"
                >
                  <h3 className="text-lg font-semibold mb-2 text-primary">{company?.name || "Empresa não identificada"}</h3>
                  <div className="divide-y">
                    {paymentList.map((p) => (
                      <div key={p.id} className="grid grid-cols-3 md:grid-cols-4 items-center py-3 text-sm">
                        <div className="col-span-2 md:col-span-2">
                          <p className="font-medium">{p.employee?.name || "Funcionário não encontrado"}</p>
                          <p className="text-xs text-muted-foreground">Entregas: {getDeliveryCount(p)}</p>
                        </div>
                        <span className="text-right">
                          {p.total_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                        <span className={`text-right font-medium ${p.status === 'pago' ? 'text-green-600' : 'text-yellow-600'}`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      );
    };
    
    export default PagamentoSemanal;