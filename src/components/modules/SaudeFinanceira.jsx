import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingDown, TrendingUp, Target, Percent, Activity } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';

const formatCurrency = (value) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'R$ 0,00';
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const HealthCard = ({ company }) => {
  const {
    name,
    faturamento,
    custoTotal,
    lucro,
    pontoEquilibrio,
    lucroPercent,
  } = company;

  const getStatus = (lucro) => {
    if (lucro > 0) return { color: 'green', text: 'Lucro' };
    if (lucro > -1000) return { color: 'amber', text: 'Atenção' };
    return { color: 'red', text: 'Prejuízo' };
  };

  const status = getStatus(lucro);

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      variants={cardVariants}
      className={`bg-card rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border-t-4 ${
        status.color === 'green' ? 'border-green-500' :
        status.color === 'amber' ? 'border-yellow-500' : 'border-red-500'
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-card-foreground">{name}</h2>
        <span className={`px-3 py-1 text-sm font-bold rounded-full ${
          status.color === 'green' ? 'bg-green-100 text-green-700' :
          status.color === 'amber' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
        }`}>
          {status.text}
        </span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoItem icon={DollarSign} label="Faturamento" value={formatCurrency(faturamento)} color="green" />
          <InfoItem icon={TrendingDown} label="Custo Total" value={formatCurrency(custoTotal)} color="red" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoItem icon={TrendingUp} label="Lucro" value={formatCurrency(lucro)} color={lucro > 0 ? 'green' : 'red'} />
          <InfoItem icon={Percent} label="% Lucro" value={`${lucroPercent.toFixed(2)}%`} color="blue" />
        </div>
        <InfoItem icon={Target} label="Ponto de Equilíbrio" value={formatCurrency(pontoEquilibrio)} color="purple" />
      </div>
    </motion.div>
  );
};

const InfoItem = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center space-x-3 p-3 bg-background rounded-lg">
    <div className={`p-2 rounded-full bg-${color}-100`}>
      <Icon className={`w-5 h-5 text-${color}-600`} />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-bold text-card-foreground text-lg">{value}</p>
    </div>
  </div>
);

const SaudeFinanceira = ({ user, companies, userCompanyAccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [period, setPeriod] = useState('monthly');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const allowedCompanies = user.is_admin
    ? companies
    : companies.filter(c => userCompanyAccess.some(access => access.user_id === user.id && access.company_id === c.id));

  useEffect(() => {
    if (allowedCompanies.length > 0) {
      setSelectedCompanies(allowedCompanies.map(c => c.id));
    }
  }, [companies, user.is_admin, user.id]);

  const fetchData = useCallback(async () => {
    if (selectedCompanies.length === 0) {
      setFinancialData([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    let startDate, endDate;
    if (period === 'monthly') {
      const [year, month] = date.split('-');
      startDate = `${year}-${month}-01`;
      endDate = new Date(year, parseInt(month, 10), 0).toISOString().split('T')[0];
    } else { // weekly
      const today = new Date();
      startDate = new Date(new Date().setDate(today.getDate() - 7)).toISOString().split('T')[0];
      endDate = new Date().toISOString().split('T')[0];
    }

    const { data: dreEntries, error: entriesError } = await supabase
      .from('dre_entries')
      .select('company_id, amount, dre_groups(type)')
      .in('company_id', selectedCompanies)
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (entriesError) {
      toast({ title: "Erro ao buscar dados financeiros", variant: "destructive" });
      setLoading(false);
      return;
    }

    const dataByCompany = allowedCompanies
      .filter(c => selectedCompanies.includes(c.id))
      .map(company => {
        const companyEntries = dreEntries.filter(e => e.company_id === company.id);
        const faturamento = companyEntries.filter(e => e.dre_groups.type === 'receita').reduce((sum, e) => sum + e.amount, 0);
        const custosFixos = companyEntries.filter(e => e.dre_groups.type === 'despesa_fixa').reduce((sum, e) => sum + e.amount, 0);
        const custosVariaveis = companyEntries.filter(e => e.dre_groups.type === 'despesa_variavel').reduce((sum, e) => sum + e.amount, 0);

        const custoTotal = Math.abs(custosFixos) + Math.abs(custosVariaveis);
        const lucro = faturamento - custoTotal;
        
        const pontoEquilibrio = faturamento > 0 && faturamento > Math.abs(custosVariaveis)
          ? Math.abs(custosFixos) / (1 - (Math.abs(custosVariaveis) / faturamento))
          : 0;

        const lucroPercent = faturamento > 0 ? (lucro / faturamento) : 0;

        return {
          id: company.id,
          name: company.name,
          faturamento,
          custosFixos: Math.abs(custosFixos),
          custosVariaveis: Math.abs(custosVariaveis),
          custoTotal,
          lucro,
          pontoEquilibrio,
          lucroPercent: lucroPercent * 100,
        };
      });

    setFinancialData(dataByCompany);
    setLoading(false);
  }, [selectedCompanies, period, date, toast, allowedCompanies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCompanySelection = (companyId) => {
    setSelectedCompanies(prev =>
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Período</label>
            <div className="flex gap-2">
              <Button onClick={() => setPeriod('monthly')} variant={period === 'monthly' ? 'default' : 'outline'} className="flex-1">Mês</Button>
              <Button onClick={() => setPeriod('weekly')} variant={period === 'weekly' ? 'default' : 'outline'} className="flex-1">Últimos 7 dias</Button>
            </div>
          </div>
          {period === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Selecione o Mês</label>
              <input type="month" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2 rounded-lg border bg-card text-foreground border-border focus:ring-2 focus:ring-primary" />
            </div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground mb-3">Empresas</h3>
          <div className="flex flex-wrap gap-2">
            {allowedCompanies.map(company => (
              <button
                key={company.id}
                onClick={() => handleCompanySelection(company.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCompanies.includes(company.id)
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted text-muted-foreground hover:bg-secondary'
                }`}
              >
                {company.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-20">
          <Activity className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {financialData.length > 0 ? (
            financialData.map(company => <HealthCard key={company.id} company={company} />)
          ) : (
            <div className="col-span-full text-center text-muted-foreground py-20 bg-card rounded-xl">
              <p>Nenhum dado financeiro encontrado para a seleção atual.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default SaudeFinanceira;