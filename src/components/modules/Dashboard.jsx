import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { DollarSign, TrendingDown, TrendingUp, AlertTriangle, Package, FileKey2, ArrowRight } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import SaudeFinanceiraCard from '@/components/dashboard/SaudeFinanceiraCard';
    import { useUser } from '@/contexts/UserContext';
    import { useNavigate } from 'react-router-dom';

    const motivationalQuotes = [
      "Acredite no processo, {name}!",
      "Grandes resultados começam com pequenas atitudes, {name}.",
      "Você é capaz de ir além todos os dias, {name}!",
      "Disciplina é o que transforma sonhos em conquistas, {name}.",
      "Seu foco define o seu sucesso, {name}.",
      "Cada desafio é uma nova oportunidade, {name}!",
      "Hoje é um ótimo dia para fazer a diferença, {name}!",
      "O sucesso é a soma dos seus esforços diários, {name}.",
      "A persistência constrói o que o talento inicia, {name}.",
      "Faça o seu melhor hoje, o amanhã será consequência, {name}.",
      "Pense grande, aja agora, {name}!",
      "A excelência está em fazer o simples com perfeição, {name}.",
      "Não espere por motivação — seja a motivação, {name}!",
      "Você é o resultado das suas escolhas, {name}.",
      "Coragem é agir mesmo com medo, {name}!",
    ];
    
    const formatCurrency = (value) => {
        if (typeof value !== 'number') {
            return 'R$ 0,00';
        }
        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const StatCard = ({ icon, title, value, color, onClick, loading, buttonText }) => {
      const Icon = icon;
      const cardClass = onClick ? 'cursor-pointer' : '';

      return (
        <motion.div 
          className={`p-6 rounded-xl flex flex-col justify-between shadow-sm text-white ${color} ${cardClass}`}
          whileHover={{ scale: onClick ? 1.03 : 1 }}
          onClick={onClick}
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold">{title}</p>
            <Icon className="w-8 h-8 opacity-70" />
          </div>
          <div>
            {loading ? <div className="h-10 bg-white/20 rounded w-3/4 animate-pulse mt-2"></div> : <h3 className="text-3xl font-bold mt-2">{formatCurrency(value)}</h3>}
          </div>
          {onClick && !loading && (
            <div className="mt-4 -mb-2 -mx-2">
                 <span className="flex items-center p-2 text-white font-semibold">
                    {buttonText} <ArrowRight className="w-4 h-4 ml-2" />
                 </span>
            </div>
          )}
        </motion.div>
      );
    };

    const AlertCard = ({ icon, title, count, color, onClick, totalValue }) => {
      const Icon = icon;
      return (
        <motion.div 
          onClick={onClick}
          className="bg-card p-4 rounded-xl flex items-center gap-4 shadow-sm cursor-pointer hover:shadow-lg transition-shadow"
          whileHover={{ scale: 1.03 }}
        >
          <div className={`p-3 rounded-full bg-${color}-100`}>
            <Icon className={`w-6 h-6 text-${color}-500`} />
          </div>
          <div>
            <p className="font-bold text-xl text-card-foreground">{count}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
            {totalValue && <p className="text-sm font-semibold text-green-600">Total: {formatCurrency(totalValue)}</p>}
          </div>
        </motion.div>
      );
    };

    const Dashboard = () => {
      const { toast } = useToast();
      const { user, companies, userCompanyAccess } = useUser();
      const navigate = useNavigate();
      const [selectedCompanies, setSelectedCompanies] = useState([]);
      const [lowStockProducts, setLowStockProducts] = useState([]);
      const [overdueBills, setOverdueBills] = useState({ count: 0, total: 0 });
      const [expiringCerts, setExpiringCerts] = useState(0);
      const [dueTodayCharges, setDueTodayCharges] = useState({ count: 0, total: 0 });
      const [toReceiveToday, setToReceiveToday] = useState(0);
      const [toPayToday, setToPayToday] = useState(0);
      const [receivedThisMonth, setReceivedThisMonth] = useState(0);
      const [loading, setLoading] = useState(true);
      const [motivationalQuote, setMotivationalQuote] = useState('');

      const [allowedCompanies, setAllowedCompanies] = useState([]);

      const hasFinancialAccess = useMemo(() => {
          if (!user) return false;
          return user.is_admin || user.role === 'Super Administrador' || user.role === 'Gerente';
      }, [user]);

      const onModuleChange = (path) => {
        navigate(`/${path}`);
      };

      useEffect(() => {
        const today = new Date().toDateString();
        const lastQuoteDate = localStorage.getItem('lastQuoteDate');
        let quoteIndex = localStorage.getItem('quoteIndex');

        if (today !== lastQuoteDate || quoteIndex === null) {
          quoteIndex = Math.floor(Math.random() * motivationalQuotes.length);
          localStorage.setItem('quoteIndex', quoteIndex);
          localStorage.setItem('lastQuoteDate', today);
        } else {
          quoteIndex = parseInt(quoteIndex, 10);
        }

        const quote = motivationalQuotes[quoteIndex].replace('{name}', user.name.split(' ')[0]);
        setMotivationalQuote(quote);
      }, [user.name]);

      useEffect(() => {
        if (user && companies && userCompanyAccess) {
          const userCompanyIds = userCompanyAccess.filter(access => access.user_id === user.id).map(access => access.company_id);
          
          if (user.is_admin || user.role === 'Super Administrador') {
            setAllowedCompanies(companies);
            setSelectedCompanies(companies.map(c => c.id));
          } else {
            const accessibleCompanies = companies.filter(c => userCompanyIds.includes(c.id));
            setAllowedCompanies(accessibleCompanies);
            setSelectedCompanies(accessibleCompanies.map(c => c.id));
          }
        }
      }, [user, companies, userCompanyAccess]);

      const fetchData = useCallback(async () => {
        if (selectedCompanies.length === 0 && allowedCompanies.length > 0 && !user.is_admin) {
             setLoading(false);
             return;
        }
        setLoading(true);
    
        const today = new Date().toISOString().split('T')[0];
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
        const queries = [
            supabase.rpc('get_low_stock_products', { p_company_ids: selectedCompanies }),
            supabase.from('contas_pagar').select('value').lt('due_date', today).in('status', ['pending', 'em aberto']).in('company_id', selectedCompanies),
            supabase.from('digital_certificates').select('*', { count: 'exact', head: true }).lte('valid_to', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).in('company_id', selectedCompanies),
            supabase.from('cobrancas').select('valor').eq('data_vencimento', today).eq('status', 'Pendente').in('company_id', selectedCompanies),
            supabase.from('contas_receber').select('value').eq('due_date', today).in('status', ['pending', 'em aberto']).in('company_id', selectedCompanies),
            supabase.from('contas_pagar').select('value').eq('due_date', today).in('status', ['pending', 'em aberto']).in('company_id', selectedCompanies),
            supabase.from('contas_receber').select('value').gte('payment_date', monthStart).eq('status', 'received').in('company_id', selectedCompanies),
        ];
    
        const [
            lowStockRes,
            overdueRes,
            certsRes,
            chargesRes,
            toReceiveRes,
            toPayRes,
            receivedMonthRes
        ] = await Promise.all(queries);
    
        setLowStockProducts(lowStockRes.data || []);
        
        const overdueData = overdueRes.data || [];
        setOverdueBills({ count: overdueData.length, total: overdueData.reduce((acc, c) => acc + c.value, 0) });
    
        setExpiringCerts(certsRes.count || 0);
    
        const chargesData = chargesRes.data || [];
        setDueTodayCharges({ count: chargesData.length, total: chargesData.reduce((acc, c) => acc + c.valor, 0) });
    
        setToReceiveToday((toReceiveRes.data || []).reduce((acc, item) => acc + item.value, 0));
        setToPayToday((toPayRes.data || []).reduce((acc, item) => acc + item.value, 0));
        setReceivedThisMonth((receivedMonthRes.data || []).reduce((acc, item) => acc + item.value, 0));
    
        setLoading(false);
      }, [selectedCompanies, allowedCompanies.length, user.is_admin]);

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
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-foreground">{motivationalQuote}</h1>
            {allowedCompanies.length > 1 && (
              <div className="bg-card p-2 rounded-xl shadow-sm">
                <div className="flex flex-wrap gap-1">
                  {allowedCompanies.map(company => (
                    <button
                      key={company.id}
                      onClick={() => handleCompanySelection(company.id)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        selectedCompanies.includes(company.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {company.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {hasFinancialAccess && <SaudeFinanceiraCard selectedCompanyIds={selectedCompanies} onModuleChange={onModuleChange} />}
            <div className="bg-card rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Gráfico de Vendas</h3>
              <div className="h-64 flex items-center justify-center bg-background rounded-lg">
                <p className="text-muted-foreground">Gráfico em desenvolvimento</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard icon={TrendingUp} title="A receber hoje" value={toReceiveToday} color="bg-green-500" onClick={() => onModuleChange('financeiro')} loading={loading} buttonText="Ir para Financeiro" />
            <StatCard icon={TrendingDown} title="A pagar hoje" value={toPayToday} color="bg-red-500" onClick={() => onModuleChange('financeiro')} loading={loading} buttonText="Ir para Financeiro" />
            <StatCard icon={DollarSign} title="Recebimentos do mês" value={receivedThisMonth} color="bg-blue-500" onClick={() => onModuleChange('financeiro')} loading={loading} buttonText="Ir para Financeiro" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AlertCard icon={AlertTriangle} title="contas em atraso" count={overdueBills.count} color="red" onClick={() => onModuleChange('financeiro')} totalValue={overdueBills.total} />
            <AlertCard icon={Package} title="produtos em estoque crítico" count={lowStockProducts.length} color="amber" onClick={() => onModuleChange('estoque')} />
            <AlertCard icon={FileKey2} title="certificados próximos do vencimento" count={expiringCerts} color="blue" onClick={() => onModuleChange('notas-fiscais')} />
            <AlertCard icon={DollarSign} title="cobranças vencendo hoje" count={dueTodayCharges.count} color="yellow" onClick={() => onModuleChange('cobrancas')} totalValue={dueTodayCharges.total} />
          </div>
        </div>
      );
    };

    export default Dashboard;