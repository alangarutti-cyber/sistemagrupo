import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { startOfWeek, endOfWeek, subWeeks, addWeeks, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, LineChart, PieChart, TrendingUp, TrendingDown, DollarSign, AlertTriangle, FileDown, ArrowLeft, ArrowRight, BrainCircuit, Activity } from 'lucide-react';
import { Bar, Pie, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import html2pdf from 'html2pdf.js';

const formatCurrency = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A239E6', '#E63946'];

const DesempenhoGrupo = () => {
    const { user, companies } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const reportRef = useRef();

    const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);
    const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);

    const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        if (user.is_admin || user.role === 'Super Administrador') return companies;
        const userCompanyIds = user.company_ids?.map(c => c.company_id) || [];
        return companies.filter(c => userCompanyIds.includes(c.id));
    }, [user, companies]);

    const fetchDataForWeek = useCallback(async (start, end) => {
        const companyIds = allowedCompanies.map(c => c.id);
        if (companyIds.length === 0) return {};

        const { data, error } = await supabase
            .from('saude_financeira_resumo')
            .select('*')
            .in('empresa_id', companyIds)
            .gte('data', format(start, 'yyyy-MM-dd'))
            .lte('data', format(end, 'yyyy-MM-dd'));

        if (error) throw error;
        return data || [];
    }, [allowedCompanies]);

    const generateReport = useCallback(async () => {
        setLoading(true);
        try {
            const currentWeekData = await fetchDataForWeek(weekStart, weekEnd);
            const previousWeekData = await fetchDataForWeek(subWeeks(weekStart, 1), subWeeks(weekEnd, 1));
            
            const processData = (data) => {
                const summary = {
                    faturamento: 0,
                    lucro: 0,
                    cmv: 0,
                    custosFixos: 0,
                    custosVariaveis: 0,
                };
                data.forEach(d => {
                    summary.faturamento += d.faturamento || 0;
                    summary.lucro += d.lucro_prejuizo || 0;
                    summary.cmv += d.cmv || 0;
                    summary.custosFixos += d.custos_fixos || 0;
                    summary.custosVariaveis += d.custos_variaveis || 0;
                });
                return summary;
            };

            const currentSummary = processData(currentWeekData);
            const previousSummary = processData(previousWeekData);
            
            const performanceByUnit = allowedCompanies.map(company => {
                const unitData = currentWeekData.filter(d => d.empresa_id === company.id);
                const prevUnitData = previousWeekData.filter(d => d.empresa_id === company.id);

                const unitSummary = processData(unitData);
                const prevUnitSummary = processData(prevUnitData);
                
                const faturamentoVar = prevUnitSummary.faturamento ? (unitSummary.faturamento - prevUnitSummary.faturamento) / prevUnitSummary.faturamento : 0;
                let status = 'green';
                if(unitSummary.lucro < 0) status = 'red';
                else if (unitSummary.faturamento > 0 && unitSummary.cmv / unitSummary.faturamento > 0.4) status = 'yellow';

                return {
                    id: company.id,
                    name: company.name,
                    faturamento: unitSummary.faturamento,
                    lucro: unitSummary.lucro,
                    cmv: unitSummary.faturamento ? unitSummary.cmv / unitSummary.faturamento : 0,
                    custosFixos: unitSummary.custosFixos,
                    status,
                    faturamentoVar,
                };
            });

            const faturamentoVar = previousSummary.faturamento ? (currentSummary.faturamento - previousSummary.faturamento) / previousSummary.faturamento : 0;
            const metaTotal = currentWeekData.reduce((acc, d) => acc + (d.meta_dia || 0), 0);

            const evolutionData = await Promise.all(
                [...Array(6).keys()].reverse().map(async i => {
                    const start = subWeeks(weekStart, i);
                    const end = subWeeks(weekEnd, i);
                    const weekData = await fetchDataForWeek(start, end);
                    return {
                        name: format(start, 'dd/MM'),
                        faturamento: weekData.reduce((acc, d) => acc + (d.faturamento || 0), 0),
                    };
                })
            );

            setReportData({
                groupSummary: {
                    faturamento: currentSummary.faturamento,
                    lucro: currentSummary.lucro,
                    cmv: currentSummary.faturamento ? currentSummary.cmv / currentSummary.faturamento : 0,
                    ticketMedio: 0,
                    faturamentoVar,
                    metaAtingida: metaTotal > 0 ? currentSummary.faturamento / metaTotal : 0,
                },
                performanceByUnit,
                evolutionData,
                alerts: performanceByUnit.filter(u => u.status !== 'green' || u.cmv > 0.4).map(u => `Atenção na unidade ${u.name}: ${u.status === 'red' ? 'Lucro Negativo.' : ''} ${u.cmv > 0.4 ? 'CMV Alto.' : ''}`),
                insights: [
                    `${performanceByUnit.sort((a,b) => b.lucro - a.lucro)[0]?.name || 'N/A'} teve o melhor resultado.`,
                    `Grupo Stout fechou a semana ${faturamentoVar > 0 ? 'acima' : 'abaixo'} da semana anterior (${formatPercent(Math.abs(faturamentoVar))}).`
                ]
            });

        } catch (error) {
            toast({ title: 'Erro ao gerar relatório', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [allowedCompanies, weekStart, weekEnd, fetchDataForWeek, toast]);

    useEffect(() => {
        generateReport();
    }, [generateReport]);
    
    const handleDownloadPdf = () => {
        const element = reportRef.current;
        const opt = {
          margin:       0.5,
          filename:     `Relatorio_Desempenho_Semanal_${format(weekStart, 'yyyy-MM-dd')}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        toast({title: "Gerando PDF...", description: "Aguarde um instante."});
        html2pdf().from(element).set(opt).save();
    };

    const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Activity className="w-10 h-10 animate-spin text-primary" /></div>;
    }

    if (!reportData) {
        return <div className="text-center p-8">Não foi possível gerar os dados do relatório.</div>;
    }

    const { groupSummary, performanceByUnit, evolutionData, alerts, insights } = reportData;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 p-4">
             <header className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Desempenho do Grupo</h1>
                    <p className="text-muted-foreground">Relatório consolidado da semana.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handlePrevWeek} variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Anterior</Button>
                    <span className="font-semibold text-primary">{format(weekStart, 'dd/MM')} a {format(weekEnd, 'dd/MM/yy')}</span>
                    <Button onClick={handleNextWeek} variant="outline">Próxima <ArrowRight className="w-4 h-4 ml-2" /></Button>
                    <Button onClick={handleDownloadPdf}><FileDown className="w-4 h-4 mr-2"/>Gerar PDF</Button>
                </div>
            </header>

            <div ref={reportRef} className="bg-white p-6 rounded-lg shadow-lg printable-content">
                <div className="text-center mb-8 border-b pb-4">
                    <img src="https://horizons-cdn.hostinger.com/6a44e4d1-b151-41db-aa41-6efe480a026e/4907d27c8ad3e4ceaa68b04717459794.jpg" alt="Stout Group Logo" className="h-16 mx-auto mb-2" />
                    <h2 className="text-2xl font-bold text-gray-800">Relatório de Desempenho Semanal</h2>
                    <p className="text-gray-500">{format(weekStart, 'dd/MM/yyyy')} a {format(weekEnd, 'dd/MM/yyyy')}</p>
                </div>

                <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">Resumo do Grupo</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <StatItem title="Faturamento Total" value={formatCurrency(groupSummary.faturamento)} />
                        <StatItem title="Lucro Líquido" value={formatCurrency(groupSummary.lucro)} positive={groupSummary.lucro >= 0} />
                        <StatItem title="CMV Médio" value={formatPercent(groupSummary.cmv)} positive={groupSummary.cmv <= 0.4} />
                        <StatItem title="Resultado vs Semana Ant." value={formatPercent(groupSummary.faturamentoVar)} positive={groupSummary.faturamentoVar >= 0} />
                        <StatItem title="Meta Atingida" value={formatPercent(groupSummary.metaAtingida)} positive={groupSummary.metaAtingida >= 1} />
                    </div>
                </section>

                <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">Desempenho por Unidade</h3>
                    <div className="space-y-4">
                        {performanceByUnit.map(unit => (
                            <UnitCard key={unit.id} unit={unit} />
                        ))}
                    </div>
                </section>

                <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">Gráficos</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-semibold text-center mb-2 text-gray-600">Faturamento por Unidade</h4>
                             <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={performanceByUnit} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" fontSize={12} />
                                    <YAxis tickFormatter={(value) => `R$${value/1000}k`} fontSize={12} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="faturamento" fill="#E63946" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <h4 className="font-semibold text-center mb-2 text-gray-600">Evolução do Faturamento (Últimas 6 Semanas)</h4>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={evolutionData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" fontSize={12} />
                                    <YAxis tickFormatter={(value) => `R$${value/1000}k`} fontSize={12}/>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Line type="monotone" dataKey="faturamento" stroke="#E63946" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                         <div className="lg:col-span-2">
                            <h4 className="font-semibold text-center mb-2 text-gray-600">Distribuição do Lucro por Unidade</h4>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={performanceByUnit.filter(u => u.lucro > 0)} dataKey="lucro" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${formatPercent(percent)}`}>
                                        {performanceByUnit.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </section>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section>
                        <h3 className="text-xl font-semibold mb-4 text-gray-700 flex items-center gap-2"><AlertTriangle className="text-yellow-500" /> Alertas Automáticos</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-600">
                            {alerts.length > 0 ? alerts.map((alert, i) => <li key={i}>{alert}</li>) : <li>Nenhum alerta para esta semana.</li>}
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold mb-4 text-gray-700 flex items-center gap-2"><BrainCircuit className="text-blue-500" /> Insights Automáticos</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-600">
                             {insights.map((insight, i) => <li key={i}>{insight}</li>)}
                        </ul>
                    </section>
                </div>
                 <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                    <p>Relatório gerado automaticamente pelo sistema Stout Group.</p>
                </footer>
            </div>
        </motion.div>
    );
};

const StatItem = ({ title, value, positive }) => (
    <div className="bg-gray-100 p-3 rounded-lg text-center">
        <p className="text-sm text-gray-500">{title}</p>
        <p className={`text-lg font-bold ${positive === undefined ? 'text-gray-800' : positive ? 'text-green-600' : 'text-red-600'}`}>{value}</p>
    </div>
);

const UnitCard = ({ unit }) => {
    const statusColors = {
        green: 'border-green-500',
        yellow: 'border-yellow-500',
        red: 'border-red-500',
    };
    return (
        <div className={`p-4 rounded-lg border-l-4 ${statusColors[unit.status]} bg-gray-50`}>
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-800">{unit.name}</h4>
                <div className="flex items-center gap-4">
                    <span className="text-sm">
                        Lucro: <span className={`font-semibold ${unit.lucro >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(unit.lucro)}</span>
                    </span>
                     <span className={`font-semibold text-sm ${unit.faturamentoVar >= 0 ? 'text-green-700' : 'text-red-700'} flex items-center`}>
                        {unit.faturamentoVar >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                        {formatPercent(unit.faturamentoVar)}
                    </span>
                </div>
            </div>
        </div>
    );
};


export default DesempenhoGrupo;