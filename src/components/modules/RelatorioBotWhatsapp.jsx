import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { BarChart3, MessageSquare, PlusCircle, DollarSign, Percent, BarChartHorizontal, PieChart as PieChartIcon, LineChart as LineChartIcon, RefreshCw, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line as RechartsLine } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const KPI_CARDS_CONFIG = [
    { title: "Mensagens Hoje", key: "messagesToday", icon: MessageSquare, color: "blue" },
    { title: "Lançamentos Criados", key: "entriesToday", icon: PlusCircle, color: "green" },
    { title: "Valor Processado Hoje", key: "valueToday", icon: DollarSign, color: "purple", formatter: formatCurrency },
    { title: "Taxa de Sucesso", key: "successRate", icon: Percent, color: "teal", formatter: (v) => `${v.toFixed(1)}%` },
];

const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];

const KpiCard = ({ title, value, icon: Icon, color, formatter = (v) => v, isLoading }) => (
    <Card className={`border-l-4 border-${color}-500`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={`h-5 w-5 text-${color}-500`} />
        </CardHeader>
        <CardContent>
            {isLoading ? <div className="h-8 w-3/4 bg-muted animate-pulse rounded-md"></div> : <div className="text-2xl font-bold">{formatter(value)}</div>}
        </CardContent>
    </Card>
);

const RelatorioBotWhatsapp = () => {
    const { user, companies } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [kpis, setKpis] = useState({ messagesToday: 0, entriesToday: 0, valueToday: 0, successRate: 100 });
    const [chartsData, setChartsData] = useState({ dailyVolume: [], typeDistribution: [], topCompanies: [] });
    const [tableData, setTableData] = useState([]);
    const [filters, setFilters] = useState({
        startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        companyId: 'all',
        type: 'all',
    });
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        if (user.is_admin) return companies;
        return companies.filter(c => user.company_ids?.some(uc => uc.company_id === c.id));
    }, [user, companies]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const todayStart = startOfDay(new Date()).toISOString();
        const sevenDaysAgo = subDays(new Date(), 7);

        try {
            const allowedCompanyIds = allowedCompanies.map(c => c.id);
            if (allowedCompanyIds.length === 0) {
                setLoading(false);
                return;
            };

            // KPIs
            const { data: todayEntries, error: todayError } = await supabase
                .from('quick_entries')
                .select('value, type')
                .in('company_id', allowedCompanyIds)
                .eq('source', 'whatsapp')
                .gte('created_at', todayStart);
            if (todayError) throw todayError;
            
            const newKpis = {
                messagesToday: todayEntries.length,
                entriesToday: todayEntries.length,
                valueToday: todayEntries.reduce((sum, entry) => sum + (entry.value || 0), 0),
                successRate: 100 // Placeholder
            };
            setKpis(newKpis);

            // Charts
            const { data: last7DaysEntries, error: last7DaysError } = await supabase
                .from('quick_entries')
                .select('created_at, type, value, company_id')
                .in('company_id', allowedCompanyIds)
                .eq('source', 'whatsapp')
                .gte('created_at', sevenDaysAgo.toISOString());
            if (last7DaysError) throw last7DaysError;

            const dailyVolume = Array.from({ length: 7 }).map((_, i) => {
                const day = subDays(new Date(), 6 - i);
                return {
                    name: format(day, 'dd/MM'),
                    count: last7DaysEntries.filter(e => format(new Date(e.created_at), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')).length
                };
            });

            const typeDistribution = [
                { name: 'Receita', value: last7DaysEntries.filter(e => e.type === 'receita').length },
                { name: 'Despesa', value: last7DaysEntries.filter(e => e.type === 'despesa').length },
            ];

            const { data: last30DaysEntries, error: last30DaysError } = await supabase
                .from('quick_entries')
                .select('company_id')
                .in('company_id', allowedCompanyIds)
                .eq('source', 'whatsapp')
                .gte('created_at', subDays(new Date(), 30).toISOString());
            if (last30DaysError) throw last30DaysError;
            
            const companyCounts = last30DaysEntries.reduce((acc, { company_id }) => {
                acc[company_id] = (acc[company_id] || 0) + 1;
                return acc;
            }, {});
            const topCompanies = Object.entries(companyCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([id, count]) => ({ name: companies.find(c => c.id == id)?.name || `ID ${id}`, count }));

            setChartsData({ dailyVolume, typeDistribution, topCompanies });

            // Table Data
            let query = supabase
                .from('quick_entries')
                .select('*, companies(name), app_users(name), user_whatsapp(phone_norm)')
                .eq('source', 'whatsapp')
                .gte('created_at', startOfDay(new Date(filters.startDate)).toISOString())
                .lte('created_at', endOfDay(new Date(filters.endDate)).toISOString())
                .order('created_at', { ascending: false });

            if (filters.companyId !== 'all') query = query.eq('company_id', filters.companyId);
            else query = query.in('company_id', allowedCompanyIds);
            
            if (filters.type !== 'all') query = query.eq('type', filters.type);

            const { data: tableEntries, error: tableError } = await query;
            if (tableError) throw tableError;
            setTableData(tableEntries);

        } catch (error) {
            toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
            setLastUpdated(new Date());
        }
    }, [allowedCompanies, toast, filters, companies]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><BarChart3 className="w-8 h-8 text-primary"/>Relatório Gerencial - Bot WhatsApp</h1>
                    <p className="text-muted-foreground mt-1">Análise de uso e desempenho do bot de lançamentos.</p>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Atualizado em: {format(lastUpdated, 'HH:mm:ss')}</span>
                    <Button onClick={() => fetchData()} variant="outline" size="sm" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                    </Button>
                </div>
            </header>

            <section>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {KPI_CARDS_CONFIG.map(config => (
                        <KpiCard key={config.key} {...config} value={kpis[config.key]} isLoading={loading} />
                    ))}
                </div>
            </section>
            
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><LineChartIcon className="w-5 h-5 text-primary"/>Volume de Mensagens (Últimos 7 dias)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartsData.dailyVolume}>
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis fontSize={12} />
                                <Tooltip />
                                <Legend />
                                <RechartsLine type="monotone" dataKey="count" name="Mensagens" stroke="#1f77b4" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-primary"/>Distribuição por Tipo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={chartsData.typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {chartsData.typeDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </section>

             <section>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BarChartHorizontal className="w-5 h-5 text-primary"/>Top 5 Empresas Ativas (Últimos 30 dias)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart layout="vertical" data={chartsData.topCompanies} margin={{ left: 80 }}>
                                <XAxis type="number" fontSize={12} />
                                <YAxis type="category" dataKey="name" fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="count" name="Mensagens" fill="#2ca02c" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </section>
            
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Lançamentos Detalhados</CardTitle>
                        <div className="flex flex-wrap gap-4 pt-4">
                            <div className="flex items-center gap-2">
                               <Filter className="w-4 h-4 text-muted-foreground"/>
                               <Input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-auto"/>
                               <span>até</span>
                               <Input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-auto"/>
                            </div>
                             <select name="companyId" value={filters.companyId} onChange={handleFilterChange} className="border p-2 rounded-md bg-background">
                                <option value="all">Todas as Empresas</option>
                                {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                             <select name="type" value={filters.type} onChange={handleFilterChange} className="border p-2 rounded-md bg-background">
                                <option value="all">Todos os Tipos</option>
                                <option value="receita">Receita</option>
                                <option value="despesa">Despesa</option>
                            </select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Data/Hora</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Empresa</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Usuário</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Valor</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-gray-200">
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i}><td colSpan="7" className="p-4"><div className="h-4 bg-muted animate-pulse rounded-md"></div></td></tr>
                                        ))
                                    ) : tableData.length === 0 ? (
                                        <tr><td colSpan="7" className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</td></tr>
                                    ) : (
                                        tableData.map(entry => (
                                            <tr key={entry.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{format(new Date(entry.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{entry.companies?.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{entry.app_users?.name || 'N/A'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${entry.type === 'receita' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{entry.type}</span></td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">{formatCurrency(entry.value)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{entry.description}</td>
                                                <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Sucesso</span></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </motion.div>
    );
};

export default RelatorioBotWhatsapp;