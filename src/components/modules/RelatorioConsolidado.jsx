import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { FileBarChart, RefreshCw, Filter, Calendar, FileDown, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2pdf from 'html2pdf.js';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

const COLORS = ['#FF8042', '#00C49F', '#FFBB28'];

const KpiCard = ({ title, value, icon: Icon, isLoading, status }) => {
    let statusColor = 'text-muted-foreground';
    if(status === 'positive') statusColor = 'text-green-500';
    if(status === 'negative') statusColor = 'text-red-500';

    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-5 w-5 ${statusColor}`} />
            </CardHeader>
            <CardContent>
            {isLoading ? <div className="h-8 w-3/4 bg-muted animate-pulse rounded-md"></div> : <div className="text-2xl font-bold">{value}</div>}
            </CardContent>
        </Card>
    );
};

const RelatorioConsolidado = () => {
    const { user, companies } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [chartData, setChartData] = useState({ revenue: [], profit: [], costs: [], weeklyRevenue: [] });
    const [alerts, setAlerts] = useState([]);

    const [filters, setFilters] = useState({
        companyId: 'all',
        period: 'monthly',
        startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    });

    const pdfRef = useRef();

    const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        if (user.is_admin) return companies;
        const userCompanyIds = user.company_ids?.map(c => c.company_id) || [];
        return companies.filter(c => userCompanyIds.includes(c.id));
    }, [user, companies]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => {
            const newFilters = { ...prev, [field]: value };
            if (field === 'period') {
                const now = new Date();
                if (value === 'monthly') {
                    newFilters.startDate = format(startOfMonth(now), 'yyyy-MM-dd');
                    newFilters.endDate = format(endOfMonth(now), 'yyyy-MM-dd');
                } else { // weekly
                    newFilters.startDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                    newFilters.endDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                }
            }
            return newFilters;
        });
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setAlerts([]);

        const companyIdsToFetch = filters.companyId === 'all'
            ? allowedCompanies.map(c => c.id)
            : [parseInt(filters.companyId)];

        try {
            const [receitasData, despesasData, metasData] = await Promise.all([
                supabase.from('contas_receber').select('company_id, value').in('company_id', companyIdsToFetch).eq('status', 'received').gte('payment_date', filters.startDate).lte('payment_date', filters.endDate),
                supabase.from('contas_pagar').select('company_id, value').in('company_id', companyIdsToFetch).eq('status', 'paid').gte('payment_date', filters.startDate).lte('payment_date', filters.endDate),
                supabase.from('metas_financeiras').select('*').in('company_id', companyIdsToFetch).eq('mes', new Date(filters.startDate).getUTCMonth() + 1).eq('ano', new Date(filters.startDate).getUTCFullYear()),
            ]);
            
            if (receitasData.error || despesasData.error || metasData.error) throw receitasData.error || despesasData.error || metasData.error;

            const data = companyIdsToFetch.map(id => {
                const company = companies.find(c => c.id === id);
                const faturamento = receitasData.data.filter(r => r.company_id === id).reduce((s, i) => s + i.value, 0);
                const despesa = despesasData.data.filter(d => d.company_id === id).reduce((s, i) => s + i.value, 0);
                const meta = metasData.data.find(m => m.company_id === id);
                
                const metaFaturamento = meta?.meta_faturamento || 0;
                const cmvPercent = (meta?.meta_cmv_percent / 100) || 0.35;
                const cmv = faturamento * cmvPercent;
                const lucro = faturamento - despesa - cmv;
                const metaCumprida = metaFaturamento > 0 ? (faturamento / metaFaturamento) : 0;
                
                if (lucro < 0) setAlerts(prev => [...prev, { type: 'error', message: `${company.name} com prejuízo no período.` }]);
                if (metaCumprida >= 1) setAlerts(prev => [...prev, { type: 'success', message: `${company.name} atingiu a meta de faturamento!` }]);
                
                return { id, name: company.name, faturamento, despesa, cmv, lucro, ticketMedio: 0, metaCumprida };
            });
            setReportData(data);

            const totalFaturamento = data.reduce((s, i) => s + i.faturamento, 0);
            setChartData({
                revenue: data.map(d => ({ name: d.name, 'Faturamento Real': d.faturamento, 'Meta': metasData.data?.find(m=>m.company_id === d.id)?.meta_faturamento || 0 })),
                profit: data.map(d => ({ name: d.name, 'Lucro Real': d.lucro, 'Meta Lucro': metasData.data?.find(m=>m.company_id === d.id)?.meta_lucro || 0 })),
                costs: [{ name: 'CMV', value: data.reduce((s, i) => s + i.cmv, 0)}, { name: 'Despesas', value: data.reduce((s, i) => s + i.despesa, 0)}],
                weeklyRevenue: [] // Populate this with another query if needed
            });

        } catch (error) {
            toast({ title: 'Erro ao gerar relatório', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [filters, allowedCompanies, companies, toast]);

    const handleGeneratePdf = () => {
        const element = pdfRef.current;
        if(!element) {
            toast({ title: 'Erro ao gerar PDF', description: 'Elemento do relatório não encontrado.', variant: 'destructive'});
            return;
        }
        const opt = {
            margin: 0.5,
            filename: `relatorio_consolidado_${filters.startDate}_a_${filters.endDate}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    const AlertBanner = ({ type, message }) => {
        const config = {
            success: { icon: CheckCircle, color: 'green' },
            warning: { icon: AlertTriangle, color: 'yellow' },
            error: { icon: ShieldAlert, color: 'red' },
        };
        const { icon: Icon, color } = config[type] || config.warning;

        return (
            <div className={`flex items-center gap-3 p-3 rounded-lg border border-${color}-500/50 bg-${color}-500/10 text-${color}-700`}>
                <Icon className="h-5 w-5" />
                <p className="font-medium text-sm">{message}</p>
            </div>
        );
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div ref={pdfRef}>
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><FileBarChart className="w-8 h-8 text-primary"/>Relatório Consolidado</h1>
                        <p className="text-muted-foreground mt-1">Análise de desempenho semanal e mensal.</p>
                    </div>
                    <img alt="Stout Group Logo" className="h-12 hidden print:block" src="https://horizons-cdn.hostinger.com/6a44e4d1-b151-41db-aa41-6efe480a026e/4907d27c8ad3e4ceaa68b04717459794.jpg" />
                </header>
                
                <div className="bg-card p-4 rounded-xl shadow-sm my-6 print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <Label htmlFor="companyId">Empresa</Label>
                            <select id="companyId" value={filters.companyId} onChange={e => handleFilterChange('companyId', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-background">
                                <option value="all">Todas</option>
                                {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="period">Período</Label>
                             <select id="period" value={filters.period} onChange={e => handleFilterChange('period', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-background">
                                <option value="monthly">Mensal</option>
                                <option value="weekly">Semanal</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><Label htmlFor="startDate">De</Label><Input id="startDate" type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} className="mt-1"/></div>
                            <div><Label htmlFor="endDate">Até</Label><Input id="endDate" type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} className="mt-1"/></div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={fetchData} className="w-full" disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Gerar</Button>
                            <Button onClick={handleGeneratePdf} variant="outline" className="w-full"><FileDown className="w-4 h-4 mr-2" /> PDF</Button>
                        </div>
                    </div>
                </div>

                {alerts.length > 0 && <div className="space-y-2 mb-6">{alerts.map((alert, i) => <AlertBanner key={i} {...alert} />)}</div>}

                <div className="space-y-8">
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                        <KpiCard title="Faturamento" value={formatCurrency(reportData.reduce((s,d) => s + d.faturamento, 0))} icon={FileBarChart} isLoading={loading} status="positive" />
                        <KpiCard title="CMV" value={formatCurrency(reportData.reduce((s,d) => s + d.cmv, 0))} icon={FileBarChart} isLoading={loading} status="negative" />
                        <KpiCard title="Despesa" value={formatCurrency(reportData.reduce((s,d) => s + d.despesa, 0))} icon={FileBarChart} isLoading={loading} status="negative" />
                        <KpiCard title="Lucro" value={formatCurrency(reportData.reduce((s,d) => s + d.lucro, 0))} icon={FileBarChart} isLoading={loading} status={reportData.reduce((s,d) => s + d.lucro, 0) > 0 ? 'positive': 'negative'} />
                        <KpiCard title="Ticket Médio" value={formatCurrency(0)} icon={FileBarChart} isLoading={loading} />
                        <KpiCard title="% Meta" value={formatPercent(reportData.reduce((s,d) => s + d.metaCumprida, 0) / (reportData.length || 1))} icon={FileBarChart} isLoading={loading} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card><CardHeader><CardTitle>Faturamento Real vs Meta</CardTitle></CardHeader><CardContent>
                            <ResponsiveContainer width="100%" height={300}><BarChart data={chartData.revenue}><XAxis dataKey="name" /><YAxis /><Tooltip formatter={formatCurrency}/><Legend /><Bar dataKey="Faturamento Real" fill="#82ca9d" /><Bar dataKey="Meta" fill="#8884d8" /></BarChart></ResponsiveContainer>
                        </CardContent></Card>
                        <Card><CardHeader><CardTitle>Lucro Real vs Meta</CardTitle></CardHeader><CardContent>
                            <ResponsiveContainer width="100%" height={300}><LineChart data={chartData.profit}><XAxis dataKey="name" /><YAxis /><Tooltip formatter={formatCurrency}/><Legend /><Line type="monotone" dataKey="Lucro Real" stroke="#82ca9d" /><Line type="monotone" dataKey="Meta Lucro" stroke="#8884d8" /></LineChart></ResponsiveContainer>
                        </CardContent></Card>
                    </div>

                     <Card>
                        <CardHeader><CardTitle>CMV e Despesas</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <RechartsPieChart>
                                    <Pie data={chartData.costs} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                        {chartData.costs.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={formatCurrency} />
                                    <Legend />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </motion.div>
    );
};

export default RelatorioConsolidado;