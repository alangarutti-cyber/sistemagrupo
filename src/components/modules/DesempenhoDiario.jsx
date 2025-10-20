import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { Activity, DollarSign, Target, Percent, TrendingUp, TrendingDown, RefreshCw, BarChart, LineChart as LineChartIcon, PieChart as PieChartIcon, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, getDaysInMonth, differenceInDays } from 'date-fns';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const PerformanceCard = ({ data, isLoading }) => {
  const { name, faturamento, cmvPercent, lucro, metaPercent, faltaVenderHoje } = data;
  
  let status = { color: 'yellow', text: 'Atenção', icon: AlertTriangle };
  if (metaPercent >= 100) {
    status = { color: 'green', text: 'Meta Atingida', icon: CheckCircle };
  } else if (metaPercent < 80) {
    status = { color: 'red', text: 'Abaixo da Meta', icon: ShieldAlert };
  }

  return (
    <Card className={`border-l-4 border-${status.color}-500`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold">{name}</CardTitle>
        <div className={`flex items-center gap-1 text-xs font-bold text-${status.color}-600`}>
          <status.icon className="h-4 w-4" />
          <span>{status.text}</span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>Carregando...</p> : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="font-semibold text-foreground">Faturamento:</div><div className="text-right">{formatCurrency(faturamento)}</div>
            <div className="font-semibold text-foreground">CMV:</div><div className="text-right">{(cmvPercent * 100).toFixed(1)}%</div>
            <div className="font-semibold text-foreground">Lucro:</div><div className={`text-right font-bold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(lucro)}</div>
            <div className="font-semibold text-foreground">% Meta:</div><div className="text-right">{metaPercent.toFixed(1)}%</div>
            <div className="font-bold text-blue-600 col-span-2 text-center mt-2 border-t pt-2">Falta vender hoje: {formatCurrency(faltaVenderHoje)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const DesempenhoDiario = () => {
    const { user, companies } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState([]);
    const [chartData, setChartData] = useState({ daily: [], profit: [], costs: [] });
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        if (user.is_admin) return companies;
        const userCompanyIds = user.company_ids?.map(uc => uc.company_id) || [];
        return companies.filter(c => userCompanyIds.includes(c.id));
    }, [user, companies]);

    useEffect(() => {
        if (allowedCompanies.length > 0 && selectedCompanyId === 'all' && !user.is_admin) {
            setSelectedCompanyId(allowedCompanies[0].id);
        }
    }, [allowedCompanies, selectedCompanyId, user.is_admin]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [year, month] = selectedMonth.split('-');
        const startDate = startOfMonth(new Date(selectedMonth));
        const endDate = endOfMonth(new Date(selectedMonth));
        const today = new Date();
        const daysInMonth = getDaysInMonth(startDate);
        const businessDays = 26; // Simplified
        const remainingDays = Math.max(0, differenceInDays(endDate, today));

        const companyIdsToFetch = selectedCompanyId === 'all' ? allowedCompanies.map(c => c.id) : [parseInt(selectedCompanyId)];

        try {
            const [receitasData, despesasData, metasData] = await Promise.all([
                supabase.from('contas_receber').select('company_id, value, payment_date').in('company_id', companyIdsToFetch).eq('status', 'received').gte('payment_date', format(startDate, 'yyyy-MM-dd')).lte('payment_date', format(endDate, 'yyyy-MM-dd')),
                supabase.from('contas_pagar').select('company_id, value').in('company_id', companyIdsToFetch).eq('status', 'paid').gte('payment_date', format(startDate, 'yyyy-MM-dd')).lte('payment_date', format(endDate, 'yyyy-MM-dd')),
                supabase.from('metas_financeiras').select('*').in('company_id', companyIdsToFetch).eq('mes', parseInt(month)).eq('ano', parseInt(year)),
            ]);

            if (receitasData.error || despesasData.error || metasData.error) throw receitasData.error || despesasData.error || metasData.error;

            const companiesToProcess = selectedCompanyId === 'all' ? allowedCompanies : allowedCompanies.filter(c => c.id === parseInt(selectedCompanyId));
            
            const perfData = companiesToProcess.map(company => {
                const faturamento = receitasData.data.filter(r => r.company_id === company.id).reduce((sum, r) => sum + r.value, 0);
                const despesas = despesasData.data.filter(d => d.company_id === company.id).reduce((sum, d) => sum + d.value, 0);
                const meta = metasData.data.find(m => m.company_id === company.id);

                const metaFaturamento = meta?.meta_faturamento || 0;
                const cmvPercent = (meta?.meta_cmv_percent / 100) || 0.35;
                const cmv = faturamento * cmvPercent;
                const lucro = faturamento - cmv - despesas;
                const metaPercent = metaFaturamento > 0 ? (faturamento / metaFaturamento) * 100 : 0;
                
                const valorRestante = Math.max(0, metaFaturamento - faturamento);
                const faltaVenderHoje = remainingDays > 0 ? valorRestante / remainingDays : valorRestante;

                return {
                    id: company.id, name: company.name, faturamento, cmvPercent, lucro, metaPercent, faltaVenderHoje, despesas, cmv, metaLucro: meta?.meta_lucro || 0
                };
            });
            setPerformanceData(perfData);

            // Chart data generation
            const totalFaturamento = perfData.reduce((s, d) => s + d.faturamento, 0);
            const totalCmv = perfData.reduce((s, d) => s + d.cmv, 0);
            const totalDespesas = perfData.reduce((s, d) => s + d.despesas, 0);
            
            setChartData({
                daily: Array.from({length: daysInMonth}, (_, i) => {
                    const day = i + 1;
                    const dayStr = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
                    const value = receitasData.data
                        .filter(r => r.payment_date === dayStr)
                        .reduce((sum, r) => sum + r.value, 0);
                    return { name: day, Faturamento: value };
                }),
                profit: perfData.map(d => ({ name: d.name, 'Lucro Real': d.lucro, 'Meta Lucro': d.metaLucro })),
                costs: [
                    { name: 'CMV', value: totalCmv },
                    { name: 'Despesas', value: totalDespesas },
                    { name: 'Lucro', value: Math.max(0, totalFaturamento - totalCmv - totalDespesas) }
                ].filter(item => item.value > 0),
            });

        } catch (error) {
            toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
            setLastUpdated(new Date());
        }
    }, [selectedCompanyId, selectedMonth, allowedCompanies, toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const COLORS = ['#FF8042', '#FFBB28', '#00C49F'];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><Activity className="w-8 h-8 text-primary"/>Dashboard de Desempenho Diário</h1>
                    <p className="text-muted-foreground mt-1">Acompanhe as metas e o desempenho em tempo real.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Atualizado: {format(lastUpdated, 'HH:mm:ss')}</span>
                    <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Recalcular
                    </Button>
                </div>
            </header>

            <div className="bg-card p-4 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="company-filter">Empresa</Label>
                    <select id="company-filter" value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-background">
                        <option value="all">Consolidado</option>
                        {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <Label htmlFor="month-filter">Mês</Label>
                    <Input id="month-filter" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full mt-1"/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <p className="col-span-full text-center">Carregando dados de desempenho...</p>
                ) : performanceData.map(data => (
                    <PerformanceCard key={data.id} data={data} isLoading={loading} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="flex items-center gap-2"><BarChart className="w-5 h-5 text-primary" />Faturamento Diário</CardTitle></CardHeader>
                    <CardContent><ResponsiveContainer width="100%" height={300}>
                        <RechartsBarChart data={chartData.daily}>
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis tickFormatter={(v) => `R$${v/1000}k`} fontSize={12} />
                            <Tooltip formatter={(v) => formatCurrency(v)} />
                            <Bar dataKey="Faturamento" fill="#8884d8" />
                        </RechartsBarChart>
                    </ResponsiveContainer></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-primary" />Distribuição de Custos</CardTitle></CardHeader>
                    <CardContent><ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                            <Pie data={chartData.costs} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {chartData.costs.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v) => formatCurrency(v)} />
                            <Legend />
                        </RechartsPieChart>
                    </ResponsiveContainer></CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><LineChartIcon className="w-5 h-5 text-primary" />Lucro Real vs. Meta</CardTitle></CardHeader>
                <CardContent><ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={chartData.profit}>
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis tickFormatter={(v) => `R$${v/1000}k`} fontSize={12} />
                        <Tooltip formatter={(v) => formatCurrency(v)} />
                        <Legend />
                        <Line type="monotone" dataKey="Meta Lucro" stroke="#ff7300" />
                        <Line type="monotone" dataKey="Lucro Real" stroke="#387908" />
                    </RechartsLineChart>
                </ResponsiveContainer></CardContent>
            </Card>
        </motion.div>
    );
};

export default DesempenhoDiario;