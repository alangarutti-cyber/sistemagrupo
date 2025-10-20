import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingDown, DollarSign, Activity, FileDown, Layers, Target, Percent, Award, ThumbsDown, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { startOfMonth, endOfMonth, format, subMonths, getMonth, getYear } from 'date-fns';
import html2pdf from 'html2pdf.js';

const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (value) => (value || 0).toLocaleString('pt-BR');
const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

const KpiCard = ({ title, value, icon: Icon, isLoading, colorClass = 'text-primary' }) => (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className={`h-5 w-5 ${colorClass}`} />
        </CardHeader>
        <CardContent>
            {isLoading ? <div className="h-8 w-3/4 bg-muted animate-pulse rounded-md"></div> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);

const RankingCard = ({ title, data, valueKey, labelKey, unit, icon: Icon, colorClass, isLoading }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-md">
                <Icon className={`w-5 h-5 ${colorClass}`} />
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading ? <p>Carregando...</p> : (
                <ul className="space-y-2">
                    {data.map((item, index) => (
                        <li key={index} className="flex justify-between items-center text-sm border-b pb-1">
                            <span className="font-medium text-foreground truncate pr-2">{item[labelKey]}</span>
                            <span className={`font-bold ${colorClass}`}>{valueKey === 'cost_per_unit' ? formatCurrency(item[valueKey]) : (valueKey === 'perc_perda' ? formatPercent(item[valueKey]) : formatNumber(item[valueKey]))} {unit}</span>
                        </li>
                    ))}
                </ul>
            )}
        </CardContent>
    </Card>
);


const DashboardGrupo = () => {
    const { user, companies } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState(null);
    const pdfRef = useRef();

    const [filters, setFilters] = useState({
        companyId: 'all',
        startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
        periodType: 'monthly'
    });

    const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        if (user.is_admin) return companies;
        const userCompanyIds = user.company_ids?.map(c => c.company_id) || [];
        return companies.filter(c => userCompanyIds.includes(c.id));
    }, [user, companies]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handlePeriodChange = (direction) => {
        setFilters(prev => {
            const currentStart = new Date(prev.startDate);
            const newStart = direction === 'next' ? startOfMonth(subMonths(currentStart, -1)) : startOfMonth(subMonths(currentStart, 1));
            return {
                ...prev,
                startDate: format(newStart, 'yyyy-MM-dd'),
                endDate: format(endOfMonth(newStart), 'yyyy-MM-dd'),
            };
        });
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const companyIdsToFetch = filters.companyId === 'all'
                ? allowedCompanies.map(c => c.id)
                : [parseInt(filters.companyId)];

            if (companyIdsToFetch.length === 0) {
                setReportData(null);
                setLoading(false);
                return;
            }
            
            const { data: productionHistoryData, error: productionHistoryError } = await supabase.from('production_history')
                    .select('*, product:products(id, name)')
                    .gte('confirmed_at', filters.startDate)
                    .lte('confirmed_at', filters.endDate);

            if (productionHistoryError) throw productionHistoryError;

            const productIds = productionHistoryData.map(p => p.product_id).filter(Boolean);
            if (productIds.length === 0) {
                setReportData({ companyReports: [], totals: { totalProduzido: 0, totalPerdas: 0, percPerdas: 0, totalCMV: 0, custoMedioUnidade: 0 }, topProduzidos: [], topCusto: [], topPerdas: [], monthlyEvolution: [] });
                setLoading(false);
                return;
            }

            const { data: productAccessData, error: productAccessError } = await supabase
                .from('product_company_access')
                .select('product_id, company_id')
                .in('product_id', productIds)
                .in('company_id', companyIdsToFetch);
                
            if (productAccessError) throw productAccessError;

            const productCompanyMap = productAccessData.reduce((acc, item) => {
                if (!acc[item.product_id]) acc[item.product_id] = [];
                acc[item.product_id].push(item.company_id);
                return acc;
            }, {});

            const productions = (productionHistoryData || []).filter(p => {
                const productCompanyIds = productCompanyMap[p.product_id] || [];
                return productCompanyIds.length > 0;
            });

            const { data: dreData, error: dreError } = await supabase.from('dre_entries')
                .select('company_id, amount, category, date')
                .in('company_id', companyIdsToFetch)
                .eq('category', 'CMV')
                .gte('date', filters.startDate)
                .lte('date', filters.endDate);
            
            if (dreError) throw dreError;
            
            const companyReports = allowedCompanies
                .filter(c => filters.companyId === 'all' || c.id === parseInt(filters.companyId))
                .map(company => {
                    const companyProductions = productions.filter(p => {
                        const productCompanyIds = productCompanyMap[p.product_id] || [];
                        return productCompanyIds.includes(company.id);
                    });
                    const companyDre = dreData.filter(d => d.company_id === company.id);

                    const totalProduzido = companyProductions.reduce((sum, p) => sum + (p.units_approved || 0), 0);
                    const totalPerdas = companyProductions.reduce((sum, p) => sum + (p.units_lost || 0), 0);
                    const totalEsperado = companyProductions.reduce((sum, p) => sum + (p.units_expected || 0), 0);
                    const totalCMV = Math.abs(companyDre.reduce((sum, d) => sum + (d.amount || 0), 0));
                    
                    return { name: company.name, totalProduzido, totalPerdas, percPerdas: totalEsperado > 0 ? totalPerdas / totalEsperado : 0, totalCMV };
                });

            const totals = {
                totalProduzido: companyReports.reduce((s, c) => s + c.totalProduzido, 0),
                totalPerdas: companyReports.reduce((s, c) => s + c.totalPerdas, 0),
                totalCMV: companyReports.reduce((s, c) => s + c.totalCMV, 0),
            };
            const totalEsperadoGlobal = productions.reduce((s, p) => s + (p.units_expected || 0), 0);
            totals.percPerdas = totalEsperadoGlobal > 0 ? totals.totalPerdas / totalEsperadoGlobal : 0;
            totals.custoMedioUnidade = totals.totalProduzido > 0 ? totals.totalCMV / totals.totalProduzido : 0;
            
            const groupAndSum = (data, key) => Object.values(data.reduce((acc, item) => {
                acc[item[key]] = acc[item[key]] || { ...item, units_approved: 0, units_lost: 0, units_expected: 0, total_cost: 0, count: 0 };
                acc[item[key]].units_approved += item.units_approved || 0;
                acc[item[key]].units_lost += item.units_lost || 0;
                acc[item[key]].units_expected += item.units_expected || 0;
                acc[item[key]].total_cost += item.total_cost || 0;
                acc[item[key]].count += 1;
                return acc;
            }, {}));

            const productsSummary = groupAndSum(productions, 'recipe_name');

            const topProduzidos = [...productsSummary].sort((a, b) => b.units_approved - a.units_approved).slice(0, 5);
            const topCusto = [...productsSummary].filter(p => p.units_approved > 0).sort((a,b) => (b.total_cost / b.units_approved) - (a.total_cost / a.units_approved)).slice(0, 5).map(p => ({...p, cost_per_unit: p.total_cost/p.units_approved }));
            const topPerdas = [...productsSummary].filter(p => p.units_expected > 0).sort((a, b) => (b.units_lost / b.units_expected) - (a.units_lost / a.units_expected)).slice(0, 5).map(p => ({...p, perc_perda: p.units_lost / p.units_expected }));


            const monthlyEvolution = [...Array(6)].map((_, i) => {
                const monthDate = subMonths(new Date(filters.startDate), i);
                const month = getMonth(monthDate);
                const year = getYear(monthDate);
                const monthProductions = productions.filter(p => {
                    const d = new Date(p.confirmed_at);
                    return getMonth(d) === month && getYear(d) === year;
                });
                return {
                    name: format(monthDate, 'MMM'),
                    producao: monthProductions.reduce((s, p) => s + (p.units_approved || 0), 0)
                };
            }).reverse();

            setReportData({ companyReports, totals, topProduzidos, topCusto, topPerdas, monthlyEvolution });

        } catch (error) {
            console.error('Fetch Error:', error);
            toast({ title: 'Erro ao buscar dados', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [filters, allowedCompanies, toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDownloadPdf = () => {
        const element = pdfRef.current;
        const opt = { margin: 0.5, filename: `dashboard_grupo_${filters.startDate}_a_${filters.endDate}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
        toast({title: "Gerando PDF...", description: "Aguarde um instante."});
        html2pdf().from(element).set(opt).save();
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-card p-4 rounded-xl shadow-sm print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4">
                    <div><h1 className="text-3xl font-bold text-foreground">Dashboard do Grupo</h1><p className="text-muted-foreground">Visão consolidada de Produção e Custos.</p></div>
                    <Button onClick={handleDownloadPdf} variant="outline"><FileDown className="w-4 h-4 mr-2"/> PDF</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <Label htmlFor="companyId">Empresa</Label>
                        <select id="companyId" value={filters.companyId} onChange={e => handleFilterChange('companyId', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-background">
                            <option value="all">Consolidar Grupo Stout</option>
                            {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end gap-2">
                        <Button onClick={() => handlePeriodChange('prev')} variant="outline" size="icon"><ChevronsLeft className="w-4 h-4" /></Button>
                        <div className="text-center flex-1"><Label>Período</Label><Input type="month" value={filters.startDate.substring(0, 7)} onChange={(e) => setFilters(prev => ({...prev, startDate: format(new Date(e.target.value), 'yyyy-MM-01'), endDate: format(endOfMonth(new Date(e.target.value)), 'yyyy-MM-dd')}))} className="mt-1"/></div>
                        <Button onClick={() => handlePeriodChange('next')} variant="outline" size="icon"><ChevronsRight className="w-4 h-4" /></Button>
                    </div>
                    <Button onClick={fetchData} disabled={loading}><Activity className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar</Button>
                </div>
            </div>

            <div ref={pdfRef} className="space-y-8 bg-white p-6 rounded-lg printable-content">
                {reportData && ( <>
                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Indicadores do Mês</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <KpiCard title="Produção Total" value={formatNumber(reportData.totals.totalProduzido) + ' un'} icon={Layers} isLoading={loading} colorClass="text-blue-500" />
                            <KpiCard title="Perdas Totais" value={formatNumber(reportData.totals.totalPerdas) + ' un'} icon={TrendingDown} isLoading={loading} colorClass="text-red-500" />
                            <KpiCard title="% de Perdas" value={formatPercent(reportData.totals.percPerdas)} icon={Percent} isLoading={loading} colorClass="text-red-500" />
                            <KpiCard title="CMV Total" value={formatCurrency(reportData.totals.totalCMV)} icon={DollarSign} isLoading={loading} colorClass="text-yellow-600" />
                            <KpiCard title="Custo Médio/un" value={formatCurrency(reportData.totals.custoMedioUnidade)} icon={Target} isLoading={loading} colorClass="text-yellow-600" />
                        </div>
                    </section>

                    <section>
                         <h2 className="text-xl font-semibold mb-4 text-gray-800">Rankings do Mês</h2>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <RankingCard title="Top 5 Mais Produzidos" data={reportData.topProduzidos} valueKey="units_approved" labelKey="recipe_name" unit="un" icon={Award} colorClass="text-blue-500" isLoading={loading} />
                            <RankingCard title="Top 5 Maior Custo/un" data={reportData.topCusto} valueKey="cost_per_unit" labelKey="recipe_name" unit="" icon={DollarSign} colorClass="text-yellow-600" isLoading={loading} />
                            <RankingCard title="Top 5 Maior Perda (%)" data={reportData.topPerdas} valueKey="perc_perda" labelKey="recipe_name" unit="" icon={ThumbsDown} colorClass="text-red-500" isLoading={loading} />
                         </div>
                    </section>
                
                    <section className="space-y-8">
                        <h2 className="text-xl font-semibold text-gray-800">Gráficos Comparativos</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card><CardHeader><CardTitle>Produção por Empresa (Unidades)</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={reportData.companyReports} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={formatNumber} /><YAxis type="category" dataKey="name" width={80} /><Tooltip formatter={formatNumber} /><Bar dataKey="totalProduzido" fill="#1F3A93" /></BarChart></ResponsiveContainer></CardContent></Card>
                            <Card><CardHeader><CardTitle>% de Perdas por Empresa</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={reportData.companyReports}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis tickFormatter={formatPercent} /><Tooltip formatter={(v) => formatPercent(v)} /><Legend /><Bar dataKey="percPerdas" fill="#E74C3C" name="Percentual de Perdas" /></BarChart></ResponsiveContainer></CardContent></Card>
                            <Card className="lg:col-span-2"><CardHeader><CardTitle>Evolução da Produção (Últimos 6 meses)</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><LineChart data={reportData.monthlyEvolution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis tickFormatter={formatNumber}/><Tooltip formatter={formatNumber}/><Legend /><Line type="monotone" dataKey="producao" stroke="#1F3A93" strokeWidth={2} name="Produção" /></LineChart></ResponsiveContainer></CardContent></Card>
                        </div>
                    </section>
                </>)}
                 <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500"><p>Relatório gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p></footer>
            </div>
        </motion.div>
    );
};

export default DashboardGrupo;