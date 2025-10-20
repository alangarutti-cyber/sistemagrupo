import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingDown, TrendingUp, Target, Activity, Calendar, BarChart2, AlertCircle, TrendingUp as TrendingUpIcon, FileDown, FileText, Settings, Send, BrainCircuit, Bell, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { startOfWeek, endOfWeek, format, eachDayOfInterval, differenceInDays, isToday, parseISO, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useReactToPrint } from 'react-to-print';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const formatCurrency = (value) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'R$ 0,00';
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatPercent = (value) => {
    if (typeof value !== 'number' || isNaN(value)) {
      return '0.0%';
    }
    return `${(value * 100).toFixed(1)}%`;
}

const InfoCard = ({ icon: Icon, label, value, color, description, isLoading, alert }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
    className={`bg-card rounded-xl p-4 shadow-sm hover:shadow-lg transition-shadow duration-300 relative overflow-hidden border-l-4 ${alert ? `border-${alert.color}-500` : `border-${color}-500`}`}
  >
    {alert && <div className={`absolute top-1 right-1 p-1`}><AlertCircle className={`w-4 h-4 text-${alert.color}-500`} /></div>}
    <div className="flex items-center justify-between mb-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <Icon className={`w-5 h-5 text-${alert ? alert.color : color}-500`} />
    </div>
    {isLoading ? (
        <div className="h-8 bg-muted rounded w-3/4 animate-pulse mt-1"></div>
    ) : (
        <h3 className={`text-2xl font-bold text-${alert ? alert.color : color}-600`}>{value}</h3>
    )}
    {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    {alert && <p className={`text-xs font-semibold text-${alert.color}-500 mt-1`}>{alert.message}</p>}
  </motion.div>
);

const ChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-background/90 backdrop-blur-sm p-3 rounded-lg border shadow-lg text-sm">
                <p className="font-bold text-foreground">{format(parseISO(data.date), "eeee, dd/MM", { locale: ptBR })}</p>
                <p className="text-green-500">Faturamento: {formatCurrency(data.faturamento)}</p>
                <div className="mt-2 border-t pt-2">
                    <p className="text-muted-foreground">Itens Vendidos:</p>
                    <ul className="list-disc list-inside text-xs">
                        <li>Burgers: {data.sales.burgers}</li>
                        <li>Rodízios: {data.sales.rodizios}</li>
                        <li>Total: {data.sales.total}</li>
                    </ul>
                </div>
            </div>
        );
    }
    return null;
};

const SimpleBarChart = ({ data, metaDiaria }) => {
    const maxValue = useMemo(() => {
        const faturamentoMax = Math.max(...data.map(d => d.faturamento), 0);
        return Math.max(faturamentoMax, metaDiaria) * 1.1;
    }, [data, metaDiaria]);

    const metaPosition = maxValue > 0 ? (metaDiaria / maxValue) * 100 : 0;

    return (
        <div className="h-64 flex justify-around items-end gap-2 p-4 relative">
             {maxValue > 0 && metaDiaria > 0 && (
                <div className="absolute top-0 bottom-0 left-4 right-4" style={{ top: `${100 - metaPosition}%` }}>
                    <div className="flex items-center">
                        <span className="text-xs text-blue-500 whitespace-nowrap mr-2">Meta {formatCurrency(metaDiaria)}</span>
                        <div className="w-full border-t border-dashed border-blue-500"></div>
                    </div>
                </div>
            )}
            {data.map((day, index) => {
                const barHeight = maxValue > 0 ? (day.faturamento / maxValue) * 100 : 0;
                return (
                    <div key={index} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        <div className="w-full flex justify-center items-end" style={{ height: '100%' }}>
                            <motion.div
                                className="w-3/4 max-w-12 bg-primary rounded-t-md hover:bg-primary/80 transition-colors"
                                initial={{ height: 0 }}
                                animate={{ height: `${barHeight}%` }}
                                transition={{ duration: 0.5, delay: index * 0.05 }}
                            ></motion.div>
                        </div>
                        <span className="text-xs text-muted-foreground mt-2 capitalize">{format(parseISO(day.date), 'eee', { locale: ptBR })}</span>
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                            <ChartTooltip active={true} payload={[{payload: day}]} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ReportComponent = React.forwardRef(({ reportData, reportType, companyName, companyLogo }, ref) => {
    const { toast } = useToast();
    const handlePrint = useReactToPrint({
      content: () => ref.current,
      onAfterPrint: () => toast({ title: 'Relatório pronto para impressão/salvamento!' }),
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
            <div ref={ref} className="bg-white text-black p-8 rounded-lg shadow-2xl max-w-2xl w-full">
                <header className="flex justify-between items-center mb-6 border-b pb-4">
                    <img src={companyLogo} alt="Logotipo da Empresa" className="h-12" />
                    <h2 className="text-2xl font-bold">
                        {reportType === 'daily' ? 'Relatório Diário' : 'Relatório Semanal'}
                    </h2>
                </header>
                
                {reportType === 'daily' && reportData && (
                    <>
                        <p className="text-sm text-gray-600 mb-1">Empresa: {companyName}</p>
                        <p className="text-sm text-gray-600 mb-4">Data: {format(parseISO(reportData.date), 'dd/MM/yyyy')}</p>
                        <div className="space-y-3">
                            <p><strong>Faturamento do Dia:</strong> {formatCurrency(reportData.faturamentoDiario)}</p>
                            <p><strong>CMV (%):</strong> {formatPercent(reportData.cmvPercent)}</p>
                            <p><strong>Custos (Fixos + Variáveis):</strong> {formatCurrency(reportData.custosDiarios)}</p>
                            <p className={reportData.lucroDiario < 0 ? 'text-red-600' : 'text-green-600'}><strong>Lucro/Prejuízo:</strong> {formatCurrency(reportData.lucroDiario)}</p>
                            <p><strong>Meta Mínima Diária:</strong> {formatCurrency(reportData.metaMinimaDiaria)}</p>
                            <p><strong>Resultado vs Meta:</strong> {formatCurrency(reportData.faturamentoDiario - reportData.metaMinimaDiaria)}</p>
                            <p className="mt-4 pt-4 border-t"><strong>Indicador de Alerta:</strong> <span className={`font-bold text-${reportData.alert?.color}-600`}>{reportData.alert?.message || 'Tudo OK'}</span></p>
                        </div>
                    </>
                )}
                {reportType === 'weekly' && reportData && (
                     <>
                        <p className="text-sm text-gray-600 mb-1">Empresa: {companyName}</p>
                        <p className="text-sm text-gray-600 mb-4">Semana de {format(startOfWeek(parseISO(reportData.date), { weekStartsOn: 0 }), 'dd/MM')} a {format(endOfWeek(parseISO(reportData.date), { weekStartsOn: 0 }), 'dd/MM/yyyy')}</p>
                        <div className="space-y-3">
                            <p><strong>Faturamento Total:</strong> {formatCurrency(reportData.faturamentoSemanal)}</p>
                            <p><strong>CMV Médio (%):</strong> {formatPercent(reportData.cmvPercentSemanal)}</p>
                            <p><strong>Custos Totais:</strong> {formatCurrency(reportData.custoTotalSemanal)}</p>
                            <p className={reportData.margemFinal < reportData.margemDesejada / 100 ? 'text-red-600' : 'text-green-600'}><strong>Margem Final:</strong> {formatPercent(reportData.margemFinal)}</p>
                            <p><strong>Meta Semanal:</strong> {formatCurrency(reportData.metaSemanal)}</p>
                            <p><strong>Atingimento da Meta:</strong> {formatPercent(reportData.metaSemanal > 0 ? reportData.faturamentoSemanal / reportData.metaSemanal : 0)}</p>
                            <p className="mt-4 pt-4 border-t"><strong>Projeção Próxima Semana:</strong> {formatCurrency(reportData.projetadoProximaSemana)}</p>
                        </div>
                    </>
                )}
                <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                    <p>Relatório gerado por Stout System</p>
                </footer>
            </div>
             <div className="absolute top-4 right-4">
                <Button onClick={handlePrint} className="ml-4">Imprimir/Salvar PDF</Button>
            </div>
        </div>
    );
});


const SaudeFinanceiraAvancada = () => {
  const { user, companies, userCompanyAccess } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    faturamentoDiario: 0, cmvDiario: 0, custosDiarios: 0, lucroDiario: 0, metaMinimaDiaria: 0,
    faturamentoSemanal: 0, cmvAcumuladoSemana: 0, metaSemanal: 0, faltanteParaMeta: 0, vendaDiariaNecessaria: 0,
    projetadoSemanal: 0, cmvPercent: 0, isMetaAtingida: false, sugestaoAjuste: 0,
    custoTotalSemanal: 0,
  });
  const [previousWeekData, setPreviousWeekData] = useState(null);
  const [alerts, setAlerts] = useState({});
  const [chartData, setChartData] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [saudeFinanceiraEntries, setSaudeFinanceiraEntries] = useState([]);
  
  // Configs
  const [margemDesejada, setMargemDesejada] = useState(20);
  const [limiteCMV, setLimiteCMV] = useState(40);
  
  const reportRef = React.useRef();
  const [showReport, setShowReport] = useState(null);
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);

  const allowedCompanies = useMemo(() => user.is_admin ? companies : companies.filter(c => userCompanyAccess.some(access => access.user_id === user.id && access.company_id === c.id)), [user, companies, userCompanyAccess]);
  const allowedCompanyIds = useMemo(() => allowedCompanies.map(c => c.id), [allowedCompanies]);
  
  const hasDataToClear = useMemo(() => saudeFinanceiraEntries.length > 0 || data.faturamentoSemanal > 0 || data.custoTotalSemanal > 0, [saudeFinanceiraEntries, data]);
  
  const fetchDataForPeriod = useCallback(async (startDate, endDate, companyIds, margem) => {
      const weekDays = eachDayOfInterval({ start: startDate, end: endDate }).map(d => format(d, 'yyyy-MM-dd'));
      
      const [faturamentoData, custosFixosData, weeklyPaymentsData, custosVariaveisData, saudeFinanceiraData] = await Promise.all([
          supabase.from('cash_closings').select('closing_date, total_conferred, qtd_burger_delivery, qtd_burger_salao, qtd_rodizio, qtd_rodizio_meia').in('company_id', companyIds).in('closing_date', weekDays),
          supabase.from('contas_pagar').select('value, payment_date, dre_groups(type)').in('company_id', companyIds).in('payment_date', weekDays).eq('status', 'paid').eq('dre_groups.type', 'fixo'),
          supabase.from('weekly_payments').select('total_value, paid_at').in('company_id', companyIds).gte('paid_at', format(startDate, 'yyyy-MM-dd')).lte('paid_at', format(endDate, 'yyyy-MM-dd')).eq('status', 'pago'),
          supabase.from('contas_pagar').select('value, payment_date, dre_groups(type)').in('company_id', companyIds).in('payment_date', weekDays).eq('status', 'paid').eq('dre_groups.type', 'variavel'),
          supabase.from('saude_financeira_resumo').select('*').in('empresa_id', companyIds).in('data', weekDays)
      ]);

      if (faturamentoData.error) throw faturamentoData.error;
      if (custosFixosData.error) throw custosFixosData.error;
      if (weeklyPaymentsData.error) throw weeklyPaymentsData.error;
      if (custosVariaveisData.error) throw custosVariaveisData.error;
      if (saudeFinanceiraData.error) throw saudeFinanceiraData.error;

      setSaudeFinanceiraEntries(saudeFinanceiraData.data || []);

      const faturamentoSemanal = faturamentoData.data?.reduce((sum, item) => sum + item.total_conferred, 0) || 0;
      const custosFixosSemanal = custosFixosData.data?.reduce((sum, item) => sum + item.value, 0) || 0;
      const custoEquipeSemanal = (weeklyPaymentsData.data?.reduce((sum, item) => sum + item.total_value, 0) || 0) + (custosVariaveisData.data?.reduce((sum, item) => sum + item.value, 0) || 0);
      
      const cmvPercent = limiteCMV / 100;
      const cmvAcumuladoSemana = faturamentoSemanal * cmvPercent;
      const custoTotalSemanal = cmvAcumuladoSemana + custoEquipeSemanal + custosFixosSemanal;
      const margemLiquida = faturamentoSemanal > 0 ? (faturamentoSemanal - custoTotalSemanal) / faturamentoSemanal : 0;

      return {
          faturamentoSemanal,
          cmvAcumuladoSemana,
          custosFixosSemanal,
          custoEquipeSemanal,
          custoTotalSemanal,
          margemLiquida,
          faturamentoData: faturamentoData.data || [],
          custosFixosData: custosFixosData.data || [],
          weeklyPaymentsData: weeklyPaymentsData.data || [],
          custosVariaveisData: custosVariaveisData.data || [],
      };
  }, [limiteCMV]);

  const fetchData = useCallback(async () => {
    if (allowedCompanyIds.length === 0) { setLoading(false); return; }
    setLoading(true);

    const today = parseISO(selectedDate);
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
    const prevWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
    const prevWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });

    const companyIds = selectedCompany !== 'all' ? [parseInt(selectedCompany)] : allowedCompanyIds;

    try {
        const [currentWeek, previousWeek] = await Promise.all([
            fetchDataForPeriod(weekStart, weekEnd, companyIds, margemDesejada),
            fetchDataForPeriod(prevWeekStart, prevWeekEnd, companyIds, margemDesejada),
        ]);
        setPreviousWeekData(previousWeek);

        const { faturamentoSemanal, cmvAcumuladoSemana, custosFixosSemanal, custoEquipeSemanal, custoTotalSemanal, faturamentoData, custosFixosData, weeklyPaymentsData, custosVariaveisData } = currentWeek;

        const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).map(d => format(d, 'yyyy-MM-dd'));
        const newChartData = weekDays.map(date => {
            const dayData = faturamentoData.filter(f => f.closing_date === date) || [];
            const faturamento = dayData.reduce((sum, item) => sum + item.total_conferred, 0);
            const burgers = dayData.reduce((sum, item) => sum + (item.qtd_burger_delivery || 0) + (item.qtd_burger_salao || 0), 0);
            const rodizios = dayData.reduce((sum, item) => sum + (item.qtd_rodizio || 0) + (item.qtd_rodizio_meia || 0), 0);
            return { date, faturamento, sales: { burgers, rodizios, total: burgers + rodizios } };
        });
        setChartData(newChartData);

        const faturamentoDiario = newChartData.find(d => d.date === selectedDate)?.faturamento || 0;
        
        const custosFixosDiarios = (custosFixosData.filter(c => c.payment_date === selectedDate).reduce((sum, item) => sum + item.value, 0) || 0);
        const custoEquipeDiario = (weeklyPaymentsData.filter(p => format(new Date(p.paid_at), 'yyyy-MM-dd') === selectedDate).reduce((sum, item) => sum + item.total_value, 0) || 0) + 
                                  (custosVariaveisData.filter(c => c.payment_date === selectedDate).reduce((sum, item) => sum + item.value, 0) || 0);

        const cmvDiario = faturamentoDiario * (limiteCMV / 100);
        const custosDiarios = custosFixosDiarios + custoEquipeDiario;
        const lucroDiario = faturamentoDiario - cmvDiario - custosDiarios;
        
        const metaSemanal = custoTotalSemanal > 0 ? custoTotalSemanal / (1 - (margemDesejada / 100)) : 0;
        const metaMinimaDiaria = metaSemanal > 0 ? metaSemanal / weekDays.length : 0;
        
        const faltanteParaMeta = Math.max(0, metaSemanal - faturamentoSemanal);
        const diasRestantes = Math.max(1, differenceInDays(weekEnd, today) + (isToday(today) ? 1 : 0));
        const vendaDiariaNecessaria = faltanteParaMeta / diasRestantes;
        
        const diasPassados = differenceInDays(today, weekStart) + 1;
        const faturamentoMedioDiario = diasPassados > 0 ? faturamentoSemanal / diasPassados : 0;
        const projetadoSemanal = faturamentoSemanal + (faturamentoMedioDiario * (weekDays.length - diasPassados));
        
        const ritmoAtual = faturamentoMedioDiario;
        const ritmoNecessario = vendaDiariaNecessaria;
        const sugestaoAjuste = ritmoNecessario > ritmoAtual ? ((ritmoNecessario / ritmoAtual) - 1) * 100 : 0;

        const cmvPercentSemanal = faturamentoSemanal > 0 ? cmvAcumuladoSemana / faturamentoSemanal : 0;

        const margemFinal = faturamentoSemanal > 0 ? (faturamentoSemanal - custoTotalSemanal) / faturamentoSemanal : 0;

        setData({
            faturamentoDiario, cmvDiario, custosDiarios, lucroDiario, metaMinimaDiaria, faturamentoSemanal,
            cmvAcumuladoSemana, metaSemanal, faltanteParaMeta, vendaDiariaNecessaria, projetadoSemanal,
            isMetaAtingida: faturamentoSemanal >= metaSemanal, sugestaoAjuste, custoTotalSemanal,
            cmvPercentSemanal, margemFinal,
            projetadoProximaSemana: faturamentoMedioDiario * 7,
        });

        const newAlerts = {};
        if (cmvPercentSemanal > limiteCMV / 100) newAlerts.cmv = { color: 'red', message: 'Cuidado: CMV acima do limite' };
        if (faturamentoDiario < metaMinimaDiaria * 0.8) newAlerts.faturamento = { color: 'yellow', message: 'Atenção: abaixo de 80% da meta' };
        if (lucroDiario < 0) newAlerts.lucro = { color: 'red', message: 'Dia com prejuízo' };
        if (margemFinal > margemDesejada / 100) newAlerts.semana = { color: 'green', message: 'Semana positiva! Lucro saudável' };
        setAlerts(newAlerts);

    } catch (error) { toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [selectedCompany, selectedDate, margemDesejada, toast, allowedCompanyIds, fetchDataForPeriod, limiteCMV]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSendReport = (type) => {
    const companyName = selectedCompany === 'all' ? 'Consolidado' : allowedCompanies.find(c => c.id === parseInt(selectedCompany))?.name;
    const companyLogo = "https://horizons-cdn.hostinger.com/6a44e4d1-b151-41db-aa41-6efe480a026e/4907d27c8ad3e4ceaa68b04717459794.jpg"; // Default logo
    const reportData = {
        date: selectedDate,
        faturamentoDiario: data.faturamentoDiario,
        cmvPercent: limiteCMV/100,
        custosDiarios: data.custosDiarios,
        lucroDiario: data.lucroDiario,
        metaMinimaDiaria: data.metaMinimaDiaria,
        alert: alerts.lucro || alerts.faturamento || alerts.cmv,
        faturamentoSemanal: data.faturamentoSemanal,
        cmvPercentSemanal: data.cmvPercentSemanal,
        custoTotalSemanal: data.custoTotalSemanal,
        margemFinal: data.margemFinal,
        metaSemanal: data.metaSemanal,
        margemDesejada,
        projetadoProximaSemana: data.projetadoProximaSemana
    };

    const ReportContent = () => (
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Visualização do Relatório</DialogTitle>
        </DialogHeader>
        <ReportComponent ref={reportRef} reportData={reportData} reportType={type} companyName={companyName} companyLogo={companyLogo}/>
      </DialogContent>
    );
    
    setShowReport(<ReportContent />);
  };

  const handleClearData = async () => {
    const today = parseISO(selectedDate);
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).map(d => format(d, 'yyyy-MM-dd'));
    const companyIds = selectedCompany !== 'all' ? [parseInt(selectedCompany)] : allowedCompanyIds;

    const { error } = await supabase
      .from('saude_financeira_resumo')
      .delete()
      .in('empresa_id', companyIds)
      .in('data', weekDays);

    if (error) {
      toast({ title: 'Erro ao limpar dados', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dados limpos com sucesso!', description: 'Os registros da semana foram removidos.', variant: 'success' });
      setSaudeFinanceiraEntries([]);
      fetchData();
    }
    setIsClearAlertOpen(false);
  };

  const getLucroColor = (lucro) => {
    if (lucro > 0) return 'green';
    if (lucro === 0) return 'yellow';
    return 'red';
  }

  const automaticObservation = useMemo(() => {
    if (!previousWeekData || !data) return "Analisando dados...";

    const cmvDiff = data.cmvPercentSemanal - previousWeekData.margemLiquida;
    const faturamentoDiff = data.faturamentoSemanal - previousWeekData.faturamentoSemanal;
    const margemDiff = data.margemFinal - previousWeekData.margemLiquida;
    
    let obs = [];
    if (Math.abs(cmvDiff) > 0.01) {
        obs.push(`O CMV ${cmvDiff > 0 ? 'subiu' : 'caiu'} ${formatPercent(Math.abs(cmvDiff))} em relação à semana passada.`);
    }
    if (Math.abs(faturamentoDiff) > 1) {
        obs.push(`O faturamento ${faturamentoDiff > 0 ? 'aumentou' : 'diminuiu'} ${formatCurrency(Math.abs(faturamentoDiff))}.`);
    }
    if (Math.abs(margemDiff) > 0.01) {
        obs.push(`A margem líquida ${margemDiff > 0 ? 'subiu' : 'caiu'} de ${formatPercent(previousWeekData.margemLiquida)} para ${formatPercent(data.margemFinal)}.`);
    }

    return obs.length > 0 ? obs.join(' ') : "Nenhuma variação significativa em relação à semana anterior.";
  }, [data, previousWeekData]);

  return (
    <div className="space-y-8">
      {showReport && 
        <Dialog open onOpenChange={() => setShowReport(null)}>
            {showReport}
        </Dialog>
      }
      <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente os registros de saúde financeira para a semana e empresa(s) selecionada(s). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearData} className="bg-destructive hover:bg-destructive/90">
              Sim, limpar dados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Saúde Financeira Avançada</h1>
          <p className="text-muted-foreground mt-1">Seu copiloto financeiro para decisões estratégicas e lucrativas.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleSendReport('daily')}><Send className="w-4 h-4 mr-2" /> Rel. Diário</Button>
            <Button variant="outline" size="sm" onClick={() => handleSendReport('weekly')}><Send className="w-4 h-4 mr-2" /> Rel. Semanal</Button>
            {hasDataToClear && !loading && (
                <Button variant="destructive" size="sm" onClick={() => setIsClearAlertOpen(true)}><Trash2 className="w-4 h-4 mr-2" /> Limpar Dados</Button>
            )}
        </div>
      </header>

      <div className="bg-card rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Empresa</label>
            <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full px-4 py-2 rounded-lg border bg-background text-foreground border-border focus:ring-2 focus:ring-primary">
                <option value="all">Consolidado</option>
                {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Data Base</label>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full" />
          </div>
      </div>
      
      <section>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Calendar className="w-6 h-6 text-primary"/> Resumo do Dia</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoCard label="Faturamento de Hoje" value={formatCurrency(data.faturamentoDiario)} icon={DollarSign} color="green" isLoading={loading} alert={alerts.faturamento}/>
          <InfoCard label="Lucro do Dia" value={formatCurrency(data.lucroDiario)} icon={data.lucroDiario >= 0 ? TrendingUp : TrendingDown} color={getLucroColor(data.lucroDiario)} isLoading={loading} alert={alerts.lucro} />
          <InfoCard label="Meta Mínima Diária" value={formatCurrency(data.metaMinimaDiaria)} icon={Target} color="blue" isLoading={loading} alert={!loading && data.faturamentoDiario < data.metaMinimaDiaria ? {color: 'yellow', message:'Abaixo da meta'} : null} />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Activity className="w-6 h-6 text-primary"/> Visão da Semana</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-card-foreground mb-4">Faturamento por Dia</h3>
            {loading ? (
                <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg"><p className="text-muted-foreground">Carregando gráfico...</p></div>
            ) : ( <SimpleBarChart data={chartData} metaDiaria={data.metaMinimaDiaria} /> )}
          </div>
          <div className="bg-card rounded-xl p-6 shadow-sm flex flex-col justify-center space-y-4">
              <InfoCard label="Meta Semanal" value={formatCurrency(data.metaSemanal)} icon={Target} color="blue" isLoading={loading}/>
              <InfoCard label="Faturado até hoje" value={formatCurrency(data.faturamentoSemanal)} icon={TrendingUp} color="green" isLoading={loading} alert={alerts.semana}/>
              <InfoCard label="Faltam para Meta" value={formatCurrency(data.faltanteParaMeta)} icon={TrendingDown} color="red" isLoading={loading}/>
              <InfoCard label="Venda Diária Necessária" value={formatCurrency(data.vendaDiariaNecessaria)} icon={DollarSign} color="orange" isLoading={loading}/>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><BrainCircuit className="w-6 h-6 text-primary"/> Projeções e Análises</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <InfoCard label="Projeção Faturamento Semanal" value={formatCurrency(data.projetadoSemanal)} icon={TrendingUpIcon} color="blue" description="Baseado no ritmo atual de vendas." isLoading={loading} alert={!loading && data.projetadoSemanal < data.metaSemanal ? {color: 'yellow', message:'Projeção abaixo da meta'} : null}/>
          <InfoCard label="Ajuste de Ritmo Necessário" value={data.sugestaoAjuste > 0 ? `+${data.sugestaoAjuste.toFixed(1)}%` : "Manter"} icon={data.sugestaoAjuste > 0 ? AlertCircle : Target} color={data.sugestaoAjuste > 0 ? "red" : "green"} description="Para bater a meta semanal." isLoading={loading}/>
          <InfoCard label="CMV Acumulado na Semana" value={formatPercent(data.cmvPercentSemanal)} icon={BarChart2} color="purple" description={`Limite: ${formatPercent(limiteCMV/100)}`} isLoading={loading} alert={alerts.cmv} />
        </div>
         <div className="mt-6 bg-card rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-card-foreground mb-2 flex items-center gap-2"><Bell className="w-5 h-5"/> Análise Automática</h3>
            <p className="text-muted-foreground">{loading ? 'Analisando...' : automaticObservation}</p>
        </div>
      </section>
      
      <section>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Settings className="w-6 h-6 text-primary"/> Configurações de Alertas</h2>
        <div className="bg-card rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Margem de Lucro Desejada (%)</label>
                <Input type="number" value={margemDesejada} onChange={(e) => setMargemDesejada(parseFloat(e.target.value) || 0)} className="w-full" placeholder="Ex: 20" />
            </div>
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Limite de CMV (%)</label>
                <Input type="number" value={limiteCMV} onChange={(e) => setLimiteCMV(parseFloat(e.target.value) || 0)} className="w-full" placeholder="Ex: 40" />
            </div>
        </div>
      </section>

    </div>
  );
};

export default SaudeFinanceiraAvancada;