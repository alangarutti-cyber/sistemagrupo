import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { TrendingUp, RefreshCw, BarChart, PieChart as PieChartIcon, ArrowLeft, ArrowRight, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const ProjectionCard = ({ data, isLoading }) => {
    const { name, faturamentoPrevisto, despesaPrevista, lucroPrevisto } = data;

    let status = { color: 'yellow', text: 'Neutro', icon: AlertTriangle };
    if (lucroPrevisto > 0) {
        status = { color: 'green', text: 'Positivo', icon: CheckCircle };
    } else if (faturamentoPrevisto > 0 && lucroPrevisto / faturamentoPrevisto < -0.05) {
        status = { color: 'red', text: 'Negativo', icon: ShieldAlert };
    } else if (lucroPrevisto < 0) {
        status = { color: 'red', text: 'Negativo', icon: ShieldAlert };
    }


    return (
        <Card className={`border-l-4 border-${status.color}-500 transition-all hover:shadow-lg`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold">{name}</CardTitle>
                <div className={`flex items-center gap-1 text-xs font-bold text-${status.color}-600`}>
                    <status.icon className="h-4 w-4" />
                    <span>{status.text}</span>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <p>Calculando...</p> : (
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between font-medium"><span>Faturamento Previsto:</span> <span>{formatCurrency(faturamentoPrevisto)}</span></div>
                        <div className="flex justify-between"><span>Despesa Prevista:</span> <span>{formatCurrency(despesaPrevista)}</span></div>
                        <div className="flex justify-between font-bold text-lg"><span>Lucro Previsto:</span> <span className={`${lucroPrevisto >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(lucroPrevisto)}</span></div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


const ProjecaoSemanal = () => {
    const { user, companies } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [projectionData, setProjectionData] = useState([]);
    const [chartData, setChartData] = useState({ daily: [], costs: [] });
    const [currentDate, setCurrentDate] = useState(new Date());

    const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
    const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);

    const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        if (user.is_admin) return companies;
        const userCompanyIds = user.company_ids?.map(uc => uc.company_id) || [];
        return companies.filter(c => userCompanyIds.includes(c.id));
    }, [user, companies]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const today = new Date();
        const daysPassed = Math.max(1, differenceInDays(today, weekStart) > 6 ? 7 : differenceInDays(today, weekStart) + 1);
        const daysInWeek = 7;
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        
        try {
            const [receitasData, despesasData, metasData] = await Promise.all([
                supabase.from('contas_receber').select('company_id, value, payment_date').in('company_id', allowedCompanies.map(c => c.id)).eq('status', 'received').gte('payment_date', format(weekStart, 'yyyy-MM-dd')).lte('payment_date', format(weekEnd, 'yyyy-MM-dd')),
                supabase.from('contas_pagar').select('company_id, value').in('company_id', allowedCompanies.map(c => c.id)).eq('status', 'paid').gte('payment_date', format(weekStart, 'yyyy-MM-dd')).lte('payment_date', format(weekEnd, 'yyyy-MM-dd')),
                supabase.from('metas_financeiras').select('*').in('company_id', allowedCompanies.map(c => c.id)).eq('mes', currentMonth).eq('ano', currentYear)
            ]);
            
            if(receitasData.error || despesasData.error || metasData.error) throw new Error(receitasData.error?.message || despesasData.error?.message || metasData.error?.message);

            const projData = allowedCompanies.map(company => {
                const faturamentoReal = receitasData.data.filter(r => r.company_id === company.id).reduce((sum, r) => sum + r.value, 0);
                const despesasReais = despesasData.data.filter(d => d.company_id === company.id).reduce((sum, d) => sum + d.value, 0);
                const meta = metasData.data.find(m => m.company_id === company.id);
                
                const faturamentoMedioDiario = faturamentoReal / daysPassed;
                const despesaMediaDiaria = despesasReais / daysPassed;
                const cmvPercent = (meta?.meta_cmv_percent / 100) || 0.35;

                const faturamentoPrevisto = faturamentoMedioDiario * daysInWeek;
                const despesaPrevista = despesaMediaDiaria * daysInWeek;
                const cmvPrevisto = faturamentoPrevisto * cmvPercent;

                const lucroPrevisto = faturamentoPrevisto - despesaPrevista - cmvPrevisto;

                return {
                    id: company.id, name: company.name, faturamentoPrevisto, despesaPrevista, lucroPrevisto, cmvPrevisto
                };
            });

            setProjectionData(projData);

            const totalFaturamento = projData.reduce((s,d) => s + d.faturamentoPrevisto, 0);
            const totalCmv = projData.reduce((s,d) => s + d.cmvPrevisto, 0);
            const totalDespesa = projData.reduce((s,d) => s + d.despesaPrevista, 0);
            const totalLucro = Math.max(0, totalFaturamento - totalCmv - totalDespesa);

            setChartData({
                daily: eachDayOfInterval({ start: weekStart, end: weekEnd }).map(day => {
                    const isFuture = day > today;
                    const faturamentoMedioDiarioTotal = projData.reduce((s, p) => s + (p.faturamentoPrevisto / daysInWeek), 0);
                    const faturamentoRealDia = receitasData.data
                        .filter(r => format(new Date(r.payment_date + 'T00:00:00'), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
                        .reduce((s, r) => s + r.value, 0);
                    
                    return { 
                        name: format(day, 'EEE', { locale: ptBR }), 
                        'Real': isFuture ? null : faturamentoRealDia, 
                        'Projetado': isFuture ? faturamentoMedioDiarioTotal : faturamentoRealDia
                    };
                }),
                costs: [
                    { name: 'CMV', value: totalCmv },
                    { name: 'Despesas', value: totalDespesa },
                    { name: 'Lucro', value: totalLucro }
                ].filter(i => i.value > 0)
            });

        } catch (error) {
            toast({ title: 'Erro ao projetar dados', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [allowedCompanies, weekStart, weekEnd, toast]);
    
    useEffect(() => { fetchData(); }, [fetchData]);

    const handlePrevWeek = () => setCurrentDate(prev => addDays(prev, -7));
    const handleNextWeek = () => setCurrentDate(prev => addDays(prev, 7));

    const COLORS = ['#FF8042', '#FFBB28', '#00C49F'];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><TrendingUp className="w-8 h-8 text-primary"/>Projeção Semanal Automática</h1>
                    <p className="text-muted-foreground mt-1">Previsão de desempenho baseada nos dados atuais.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handlePrevWeek} variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    <span className="font-semibold text-primary text-sm whitespace-nowrap">{format(weekStart, 'dd/MM')} - {format(weekEnd, 'dd/MM/yy')}</span>
                    <Button onClick={handleNextWeek} variant="outline" size="icon"><ArrowRight className="h-4 w-4" /></Button>
                    <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Recalcular
                    </Button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                     [...Array(3)].map((_, i) => (
                        <Card key={i}><CardHeader><div className="h-5 w-3/4 bg-muted animate-pulse rounded-md"></div></CardHeader><CardContent><div className="space-y-2"><div className="h-4 w-full bg-muted animate-pulse rounded-md"></div><div className="h-4 w-5/6 bg-muted animate-pulse rounded-md"></div></div></CardContent></Card>
                     ))
                ) : projectionData.length > 0 ? (
                    projectionData.map(data => (
                        <ProjectionCard key={data.id} data={data} isLoading={loading}/>
                    ))
                ) : (
                    <div className="col-span-full text-center p-8 bg-card rounded-xl">
                        <p className="text-muted-foreground">Nenhuma empresa encontrada ou selecionada.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-3">
                    <CardHeader><CardTitle className="flex items-center gap-2"><BarChart className="w-5 h-5 text-primary"/>Faturamento Diário: Real vs. Projetado</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <RechartsBarChart data={chartData.daily}>
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis tickFormatter={(v) => `R$${v/1000}k`} fontSize={12} />
                                <Tooltip formatter={(v) => formatCurrency(v)} />
                                <Legend />
                                <Bar dataKey="Real" fill="#82ca9d" name="Faturamento Real" />
                                <Bar dataKey="Projetado" fill="#8884d8" name="Faturamento Projetado"/>
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-primary"/>Distribuição de Custos Projetada</CardTitle></CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={300}>
                            <RechartsPieChart>
                                <Pie data={chartData.costs} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {chartData.costs.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v) => formatCurrency(v)} />
                                <Legend />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    );
}

export default ProjecaoSemanal;