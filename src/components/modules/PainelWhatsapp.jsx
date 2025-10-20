import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useUser } from '@/contexts/UserContext';
import { Loader2, RefreshCw, ArrowUpCircle, ArrowDownCircle, DollarSign, Calendar as CalendarIcon, Filter, Wifi, WifiOff, ChevronsUpDown, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PainelWhatsapp = () => {
  const { toast } = useToast();
  const { user } = useUser();
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ receitas: 0, despesas: 0, resultado: 0 });
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const fetchCompanies = useCallback(async () => {
    if (!user) return;
    let query = supabase.from('companies').select('id, name');

    if (!user.is_admin) {
      const { data: accessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('company_id')
        .eq('user_id', user.id);
      
      if (accessError) {
        toast({ title: "Erro ao buscar empresas do usuário", variant: 'destructive'});
        return;
      }
      const companyIds = accessData.map(a => a.company_id);
      query = query.in('id', companyIds);
    }

    const { data: companiesData, error: companiesError } = await query.order('name');
    if (companiesError) {
      toast({ title: 'Erro ao buscar empresas', description: companiesError.message, variant: 'destructive' });
    } else {
      setCompanies(companiesData);
      if (companiesData.length > 0) {
        setSelectedCompany(user.is_admin ? 'all' : companiesData[0].id);
      }
    }
  }, [user, toast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    const fromDate = startOfDay(selectedDate);
    const toDate = endOfDay(selectedDate);
    
    let query = supabase
      .from('quick_entries')
      .select('*, companies(name)')
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString());

    if (selectedCompany && selectedCompany !== 'all') {
      query = query.eq('company_id', selectedCompany);
    } else if (!user.is_admin) {
      const userCompanyIds = companies.map(c => c.id);
      query = query.in('company_id', userCompanyIds);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(10);
    
    if (error) {
      toast({ title: 'Erro ao buscar lançamentos', description: error.message, variant: 'destructive' });
      setIsOnline(false);
    } else {
      setEntries(data);
      const newStats = data.reduce((acc, entry) => {
        if (entry.type === 'receita') {
          acc.receitas += Number(entry.value);
        } else {
          acc.despesas += Number(entry.value);
        }
        return acc;
      }, { receitas: 0, despesas: 0 });
      newStats.resultado = newStats.receitas - newStats.despesas;
      setStats(newStats);
      setIsOnline(true);
    }
    setLoading(false);
  }, [selectedDate, selectedCompany, user, toast, companies]);

  const fetchWeeklyData = useCallback(async () => {
    const fromDate = subDays(new Date(), 6);
    const toDate = endOfDay(new Date());

    let query = supabase
      .from('quick_entries')
      .select('created_at, type, value, company_id')
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString());

    if (selectedCompany && selectedCompany !== 'all') {
        query = query.eq('company_id', selectedCompany);
    } else if (!user.is_admin) {
        const userCompanyIds = companies.map(c => c.id);
        query = query.in('company_id', userCompanyIds);
    }

    const { data, error } = await query;
    if (error) {
        toast({ title: 'Erro ao buscar dados semanais', variant: 'destructive' });
    } else {
        const groupedData = data.reduce((acc, entry) => {
            const day = format(new Date(entry.created_at), 'dd/MM');
            if (!acc[day]) {
                acc[day] = { name: day, receitas: 0, despesas: 0 };
            }
            if (entry.type === 'receita') {
                acc[day].receitas += Number(entry.value);
            } else {
                acc[day].despesas += Number(entry.value);
            }
            return acc;
        }, {});
        
        const chartData = Array.from({ length: 7 }, (_, i) => {
            const date = subDays(new Date(), i);
            const dayKey = format(date, 'dd/MM');
            return groupedData[dayKey] || { name: dayKey, receitas: 0, despesas: 0 };
        }).reverse();

        setWeeklyStats(chartData);
    }
  }, [selectedCompany, user, toast, companies]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    if (companies.length > 0) {
      fetchData();
      fetchWeeklyData();
    }
  }, [fetchData, fetchWeeklyData, companies]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
      fetchWeeklyData();
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [fetchData, fetchWeeklyData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Painel WhatsApp</h1>
        <div className="flex items-center gap-2 text-sm">
          {isOnline ? (
            <span className="flex items-center gap-1 text-green-600"><Wifi size={16}/> Online</span>
          ) : (
            <span className="flex items-center gap-1 text-red-600"><WifiOff size={16}/> Desconectado</span>
          )}
          <Button variant="ghost" size="icon" onClick={() => { fetchData(); fetchWeeklyData(); }} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
            <Filter size={16} className="text-muted-foreground"/>
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
        </div>
        <div className="flex items-center gap-2">
          <CompanyCombobox
            companies={companies}
            selectedCompany={selectedCompany}
            setSelectedCompany={setSelectedCompany}
            isAdmin={user.is_admin}
          />
        </div>
      </div>

      <motion.section>
        <h2 className="text-xl font-semibold mb-3">Resumo do Dia</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Receitas" value={formatCurrency(stats.receitas)} icon={ArrowUpCircle} color="text-green-500" />
          <StatCard title="Despesas" value={formatCurrency(stats.despesas)} icon={ArrowDownCircle} color="text-red-500" />
          <StatCard title="Resultado" value={formatCurrency(stats.resultado)} icon={DollarSign} color={stats.resultado >= 0 ? "text-blue-500" : "text-red-500"} />
        </div>
      </motion.section>

      <motion.section>
        <Card>
            <CardHeader>
                <CardTitle>Estatísticas Semanais</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={weeklyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={formatCurrency} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="receitas" fill="#22c55e" name="Receitas" />
                        <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </motion.section>

      <motion.section>
        <h2 className="text-xl font-semibold mb-3">Últimas Mensagens Recebidas</h2>
        {loading ? (
            <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin"/></div>
        ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum lançamento encontrado para os filtros selecionados.</p>
        ) : (
            <div className="space-y-3">
            {entries.map(entry => (
                <Card key={entry.id} className="flex items-center p-3">
                <div className={`mr-4 text-2xl ${entry.type === 'receita' ? 'text-green-500' : 'text-red-500'}`}>
                    {entry.type === 'receita' ? '💰' : '💸'}
                </div>
                <div className="flex-grow">
                    <p className="font-semibold">{entry.description}</p>
                    <p className="text-sm text-muted-foreground">{entry.companies?.name || 'Empresa não encontrada'}</p>
                </div>
                <div className="text-right">
                    <p className={`font-bold ${entry.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(entry.value)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(entry.created_at), 'HH:mm', { locale: ptBR })}</p>
                </div>
                </Card>
            ))}
            </div>
        )}
      </motion.section>
    </motion.div>
  );
};

const StatCard = ({ icon: Icon, title, value, color }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={cn("h-4 w-4 text-muted-foreground", color)} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const CompanyCombobox = ({ companies, selectedCompany, setSelectedCompany, isAdmin }) => {
    const [open, setOpen] = useState(false);
    const displayValue = useMemo(() => {
        if (selectedCompany === 'all') return "Todas as Empresas";
        return companies.find(c => c.id === selectedCompany)?.name || "Selecione a empresa";
    }, [selectedCompany, companies]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-[200px] justify-between">
                    {displayValue}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Buscar empresa..." />
                    <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                    <CommandGroup>
                        {isAdmin && (
                             <CommandItem
                                value="all"
                                onSelect={() => {
                                    setSelectedCompany('all');
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", selectedCompany === 'all' ? "opacity-100" : "opacity-0")} />
                                Todas as Empresas
                            </CommandItem>
                        )}
                        {companies.map((company) => (
                            <CommandItem
                                key={company.id}
                                value={company.name}
                                onSelect={() => {
                                    setSelectedCompany(company.id);
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", selectedCompany === company.id ? "opacity-100" : "opacity-0")} />
                                {company.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const CustomTooltip = ({ active, payload, label }) => {
  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-card border rounded-lg shadow-lg">
        <p className="label font-bold">{`${label}`}</p>
        <p className="text-green-500">{`Receitas: ${formatCurrency(payload[0].value)}`}</p>
        <p className="text-red-500">{`Despesas: ${formatCurrency(payload[1].value)}`}</p>
      </div>
    );
  }
  return null;
};

export default PainelWhatsapp;