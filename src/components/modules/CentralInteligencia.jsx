import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { startOfWeek, endOfWeek, format, subWeeks } from 'date-fns';
import { BrainCircuit, Activity, TrendingUp, TrendingDown, Target, AlertTriangle, RefreshCw, BarChart, Trophy, FileDown } from 'lucide-react';

const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPercent = (value) => `${((value || 0) * 100).toFixed(1)}%`;

const KPI_CARD_COLORS = {
    lucro: 'bg-green-500',
    cmv: 'bg-yellow-500',
    faturamento: 'bg-blue-500',
    meta: 'bg-purple-500',
};

const KpiCard = ({ title, value, icon: Icon, colorClass, loading }) => (
    <div className={`p-4 rounded-xl text-white shadow-lg ${colorClass}`}>
        <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">{title}</h3>
            <Icon className="w-5 h-5 opacity-70" />
        </div>
        {loading ? <div className="h-8 w-3/4 mt-1 bg-white/20 animate-pulse rounded-md"></div> : <p className="text-2xl font-bold mt-1">{value}</p>}
    </div>
);

const UnitInsightCard = ({ unit, loading }) => {
    const statusConfig = {
        'Crítico': { color: 'red', icon: AlertTriangle },
        'Atenção': { color: 'yellow', icon: AlertTriangle },
        'Estável': { color: 'green', icon: TrendingUp },
    };
    const { color, icon: Icon } = statusConfig[unit.status] || statusConfig['Atenção'];

    if(loading) {
        return (
            <div className="bg-card p-4 rounded-lg shadow animate-pulse">
                <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-full"></div>
                    <div className="h-4 bg-muted rounded w-5/6"></div>
                </div>
            </div>
        )
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`bg-card p-4 rounded-lg shadow-md border-l-4 border-${color}-500`}
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-lg text-foreground">{unit.name}</h4>
                <div className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full bg-${color}-100 text-${color}-700`}>
                    <Icon className="w-3 h-3 mr-1" />
                    {unit.status}
                </div>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
                {unit.insights.length > 0 ? (
                    unit.insights.map((insight, index) => (
                        <p key={index}>- {insight}</p>
                    ))
                ) : (
                    <p>Nenhum insight para esta unidade.</p>
                )}
            </div>
        </motion.div>
    );
};

const CentralInteligencia = () => {
    const { user, companies } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [insightsData, setInsightsData] = useState({ kpis: {}, units: [] });

    const allowedCompanies = useMemo(() => user.is_admin ? companies : companies.filter(c => user.company_ids?.some(uc => uc.company_id === c.id)), [user, companies]);
    
    const fetchData = useCallback(async () => {
        setLoading(true);
        if (allowedCompanies.length === 0) {
            setLoading(false);
            return;
        }

        try {
            const today = new Date();
            const weekStart = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
            const weekEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
            const prevWeekStart = format(startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }), 'yyyy-MM-dd');
            const prevWeekEnd = format(endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }), 'yyyy-MM-dd');

            const allowedCompanyIds = allowedCompanies.map(c => c.id);

            const [currentWeekData, prevWeekData] = await Promise.all([
                supabase.from('saude_financeira_resumo').select('*').in('empresa_id', allowedCompanyIds).gte('data', weekStart).lte('data', weekEnd),
                supabase.from('saude_financeira_resumo').select('*').in('empresa_id', allowedCompanyIds).gte('data', prevWeekStart).lte('data', prevWeekEnd),
            ]);

            if (currentWeekData.error) throw currentWeekData.error;
            if (prevWeekData.error) throw prevWeekData.error;
            
            const processWeekData = (data) => {
                return data.reduce((acc, curr) => {
                    acc.faturamento += curr.faturamento || 0;
                    acc.lucro += curr.lucro_prejuizo || 0;
                    acc.cmv += curr.cmv || 0;
                    acc.custos += (curr.custos_fixos || 0) + (curr.custos_variaveis || 0);
                    acc.meta += curr.meta_dia || 0;
                    return acc;
                }, { faturamento: 0, lucro: 0, cmv: 0, custos: 0, meta: 0 });
            };

            const currentSummary = processWeekData(currentWeekData.data);

            const unitInsights = allowedCompanies.map(company => {
                const unitData = currentWeekData.data.filter(d => d.empresa_id === company.id);
                const prevUnitData = prevWeekData.data.filter(d => d.empresa_id === company.id);

                const unitSummary = processWeekData(unitData);
                const prevUnitSummary = processWeekData(prevUnitData);

                const insights = [];
                let criticalIssues = 0;
                let warningIssues = 0;

                const cmvPercent = unitSummary.faturamento > 0 ? unitSummary.cmv / unitSummary.faturamento : 0;
                if (cmvPercent > 0.4) {
                    insights.push(`CMV está em ${formatPercent(cmvPercent)} (alto) - revisar fichas técnicas e desperdícios.`);
                    criticalIssues++;
                }

                if (unitSummary.lucro < 0) {
                    insights.push(`Lucro negativo de ${formatCurrency(unitSummary.lucro)} - analisar custos e vendas.`);
                    criticalIssues++;
                }

                if (unitSummary.faturamento < unitSummary.meta * 0.8 && unitSummary.meta > 0) {
                    insights.push(`Faturamento ${formatPercent(unitSummary.faturamento/unitSummary.meta)} da meta - considerar ações de venda.`);
                    warningIssues++;
                }
                
                const custoVar = prevUnitSummary.custos > 0 ? (unitSummary.custos - prevUnitSummary.custos) / prevUnitSummary.custos : 0;
                if (custoVar > 0.1) {
                    insights.push(`Custos totais subiram ${formatPercent(custoVar)} - verificar despesas.`);
                    warningIssues++;
                }

                let status = 'Estável';
                if (criticalIssues > 0) status = 'Crítico';
                else if (warningIssues > 0) status = 'Atenção';
                
                return {
                    id: company.id,
                    name: company.name,
                    lucro: unitSummary.lucro,
                    insights,
                    status,
                };
            });

            const sortedUnits = [...unitInsights].sort((a, b) => b.lucro - a.lucro);
            
            setInsightsData({
                kpis: {
                    lucroTotal: currentSummary.lucro,
                    cmvMedio: currentSummary.faturamento > 0 ? currentSummary.cmv / currentSummary.faturamento : 0,
                    faturamentoTotal: currentSummary.faturamento,
                    metaAtingida: currentSummary.meta > 0 ? currentSummary.faturamento / currentSummary.meta : 0,
                },
                units: unitInsights,
                topPerformers: sortedUnits.slice(0, 3),
                bottomPerformers: sortedUnits.slice(-3).reverse(),
            });

        } catch (error) {
            toast({ title: 'Erro ao analisar dados', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [allowedCompanies, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = () => {
        toast({ title: "Atualizando análises...", description: "Buscando os dados mais recentes." });
        fetchData();
    }

    const { kpis, units, topPerformers, bottomPerformers } = insightsData;
    
    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><BrainCircuit className="w-8 h-8 text-primary"/>Central de Inteligência (IA Stout)</h1>
                    <p className="text-muted-foreground mt-1">Insights e recomendações automáticas para otimizar sua gestão.</p>
                </div>
                <Button onClick={handleRefresh} variant="outline" disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                </Button>
            </header>

            <section>
                <h2 className="text-xl font-semibold mb-4 text-foreground">Resumo do Grupo (Semana)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard title="Lucro Total" value={formatCurrency(kpis.lucroTotal)} icon={TrendingUp} colorClass={KPI_CARD_COLORS.lucro} loading={loading} />
                    <KpiCard title="CMV Médio" value={formatPercent(kpis.cmvMedio)} icon={BarChart} colorClass={KPI_CARD_COLORS.cmv} loading={loading} />
                    <KpiCard title="Faturamento Total" value={formatCurrency(kpis.faturamentoTotal)} icon={Activity} colorClass={KPI_CARD_COLORS.faturamento} loading={loading} />
                    <KpiCard title="Meta Atingida" value={formatPercent(kpis.metaAtingida)} icon={Target} colorClass={KPI_CARD_COLORS.meta} loading={loading} />
                </div>
            </section>
            
            <section>
                <h2 className="text-xl font-semibold mb-4 text-foreground">Sugestões do Sistema por Unidade</h2>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => <UnitInsightCard key={i} unit={{}} loading={true} />)}
                    </div>
                ) : units.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {units.map(unit => <UnitInsightCard key={unit.id} unit={unit} loading={false} />)}
                    </div>
                ) : (
                    <div className="text-center p-8 bg-card rounded-lg text-muted-foreground">Nenhuma unidade para analisar.</div>
                )}
            </section>
            
            <section>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <div>
                        <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2"><Trophy className="text-green-500" /> Top 3 Unidades da Semana</h2>
                         <div className="space-y-3">
                            {topPerformers?.map((unit, index) => (
                                <div key={unit.id} className="bg-card p-3 rounded-md shadow-sm flex items-center justify-between">
                                    <span className="font-semibold">{index + 1}. {unit.name}</span>
                                    <span className="font-bold text-green-600">{formatCurrency(unit.lucro)}</span>
                                </div>
                            ))}
                        </div>
                     </div>
                     <div>
                        <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2"><AlertTriangle className="text-red-500" /> 3 Unidades com Menor Desempenho</h2>
                         <div className="space-y-3">
                            {bottomPerformers?.map((unit, index) => (
                                <div key={unit.id} className="bg-card p-3 rounded-md shadow-sm flex items-center justify-between">
                                    <span className="font-semibold">{index + 1}. {unit.name}</span>
                                    <span className={`font-bold ${unit.lucro < 0 ? 'text-red-600' : 'text-yellow-600'}`}>{formatCurrency(unit.lucro)}</span>
                                </div>
                            ))}
                        </div>
                     </div>
                 </div>
            </section>
            
            <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => toast({ title: 'Em breve!', description: 'Exportação em PDF estará disponível em futuras atualizações.'})}>
                    <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
                </Button>
                <Button onClick={() => toast({ title: 'Em breve!', description: 'Envio por e-mail estará disponível em futuras atualizações.'})}>
                    Enviar Resumo para Gerentes
                </Button>
            </div>
        </div>
    );
};

export default CentralInteligencia;