import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { TrendingUp, TrendingDown, Target, Percent, DollarSign, Activity, AlertCircle, ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, endOfWeek } from 'date-fns';

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
};

const DataPoint = ({ icon: Icon, label, value, isLoading, colorClass = '' }) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
    {isLoading ? (
      <div className="h-5 bg-muted rounded w-20 animate-pulse"></div>
    ) : (
      <span className={`font-semibold text-sm ${colorClass}`}>{value}</span>
    )}
  </div>
);

const SaudeFinanceiraCard = ({ selectedCompanyIds, onModuleChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!selectedCompanyIds || selectedCompanyIds.length === 0) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);

    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

      const { data: resumoData, error: resumoError } = await supabase
        .from('saude_financeira_resumo')
        .select('*')
        .in('empresa_id', selectedCompanyIds)
        .eq('data', todayStr)
        .order('created_at', { ascending: false })
        .limit(1);

      if (resumoError) throw resumoError;
      
      const { data: weekData, error: weekError } = await supabase
        .from('saude_financeira_resumo')
        .select('faturamento, meta_dia')
        .in('empresa_id', selectedCompanyIds)
        .gte('data', format(weekStart, 'yyyy-MM-dd'))
        .lte('data', format(weekEnd, 'yyyy-MM-dd'));

      if (weekError) throw weekError;

      if (resumoData && resumoData.length > 0) {
        const todayData = resumoData[0];
        
        const faturamentoSemanal = weekData.reduce((acc, curr) => acc + (curr.faturamento || 0), 0);
        const metaSemanal = weekData.reduce((acc, curr) => acc + (curr.meta_dia || 0), 0);

        setData({
          faturamentoDiario: todayData.faturamento,
          metaDiaria: todayData.meta_dia,
          cmvPercent: todayData.cmv,
          lucroDiario: todayData.lucro_prejuizo,
          projecaoSemanal: faturamentoSemanal,
          metaSemanal: metaSemanal
        });
      } else {
        setData(null);
      }
      setError(null);
    } catch (err) {
      console.error("Erro ao buscar saúde financeira:", err);
      setError("Não foi possível carregar os dados.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyIds]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30 * 60 * 1000); // 30 minutes
    return () => clearInterval(interval);
  }, [fetchData]);

  const status = useMemo(() => {
    if (loading || !data) return { color: 'gray', icon: Activity, text: 'Aguardando' };
    if (data.lucroDiario > 0) return { color: 'green', icon: TrendingUp, text: 'Positivo' };
    if (data.lucroDiario < 0) return { color: 'red', icon: TrendingDown, text: 'Negativo' };
    return { color: 'yellow', icon: AlertCircle, text: 'Atenção' };
  }, [data, loading]);

  const lucroColorClass = data?.lucroDiario > 0 ? 'text-green-600' : data?.lucroDiario < 0 ? 'text-red-600' : 'text-yellow-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl p-6 shadow-sm flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-card-foreground">💹 Saúde Financeira</h3>
        <div className={`flex items-center gap-2 text-sm font-bold text-${status.color}-500`}>
          <status.icon className="w-5 h-5" />
          <span>{status.text}</span>
        </div>
      </div>

      {error && <div className="text-center text-destructive">{error}</div>}
      {!error && !loading && !data && <div className="text-center text-muted-foreground my-auto">Sem dados para hoje.</div>}

      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <div className="flex flex-col">
          <DataPoint icon={DollarSign} label="Faturamento do Dia" value={formatCurrency(data?.faturamentoDiario)} isLoading={loading} colorClass="text-green-600 font-bold" />
          <DataPoint icon={Target} label="Meta Diária" value={formatCurrency(data?.metaDiaria)} isLoading={loading} />
          <DataPoint icon={Percent} label="CMV (%)" value={formatPercent(data?.cmvPercent)} isLoading={loading} colorClass={data?.cmvPercent > 0.4 ? 'text-red-600' : ''}/>
        </div>
        <div className="flex flex-col">
          <DataPoint icon={DollarSign} label="Lucro/Prejuízo Diário" value={formatCurrency(data?.lucroDiario)} isLoading={loading} colorClass={lucroColorClass} />
          <DataPoint icon={Activity} label="Projeção Semanal" value={`${formatCurrency(data?.projecaoSemanal)} / ${formatCurrency(data?.metaSemanal)}`} isLoading={loading} />
        </div>
      </div>
      
      <div className="mt-auto pt-4 flex justify-end">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onModuleChange('saude-financeira-avancada')}
          disabled={loading}
        >
          <span className="hidden sm:inline">Ver Detalhes</span>
          <ArrowRight className="w-4 h-4 sm:ml-2" />
          <Search className="w-4 h-4 sm:hidden" />
        </Button>
      </div>
    </motion.div>
  );
};

export default SaudeFinanceiraCard;