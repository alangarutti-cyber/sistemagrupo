
    import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Save, AlertTriangle, Plus, ShoppingCart, UserMinus, Printer, MessageSquare, ArrowDownCircle, Gift } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { toast } from '@/components/ui/use-toast';
    import { Input } from '@/components/ui/input';
    import { supabase } from '@/lib/customSupabaseClient';
    import AddMachineForm from '@/components/caixa/AddMachineForm';
    import AddExpenseForm from '@/components/caixa/AddExpenseForm';
    import AddWithdrawalForm from '@/components/caixa/AddWithdrawalForm';
    import AddCourtesyForm from '@/components/caixa/AddCourtesyForm';
    import ConferidoSection from '@/components/caixa/ConferidoSection';
    import SistemaSection from '@/components/caixa/SistemaSection';
    import SaidasSection from '@/components/caixa/SaidasSection';
    import TotaisSection from '@/components/caixa/TotaisSection';
    import PrintableClosing from '@/components/caixa/PrintableClosing';
    import { useUser } from '@/contexts/UserContext';
    import { useOutletContext } from 'react-router-dom';

    const Caixa = () => {
        const outletContext = useOutletContext();
        const userContext = useUser();
        const { user, companies } = outletContext || userContext;
        
        const [selectedCompany, setSelectedCompany] = useState('');
        const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
        const [selectedSector, setSelectedSector] = useState('Salão');
        const [addedMachines, setAddedMachines] = useState([]);
        const [expenses, setExpenses] = useState([]);
        const [withdrawals, setWithdrawals] = useState([]);
        const [courtesies, setCourtesies] = useState([]);
        const [systemValues, setSystemValues] = useState({});
        const [view, setView] = useState('main');
      
        const [allowedCompanies, setAllowedCompanies] = useState([]);
        const [hasAccess, setHasAccess] = useState(true);
        const [valorAbertura, setValorAbertura] = useState('');
        const [suprimentos, setSuprimentos] = useState('');
        const [observacoes, setObservacoes] = useState('');
        const [isLoading, setIsLoading] = useState(false);
      
        const [qtdBurgerDelivery, setQtdBurgerDelivery] = useState('');
        const [qtdBurgerSalao, setQtdBurgerSalao] = useState('');
        const [qtdRodizio, setQtdRodizio] = useState('');
        const [qtdRodizioMeia, setQtdRodizioMeia] = useState('');
        const [qtdPizzas, setQtdPizzas] = useState('');
        
        const [valorDinheiro, setValorDinheiro] = useState('');
        const [valorIfoodOnline, setValorIfoodOnline] = useState('');
        const [valorPixCnpj, setValorPixCnpj] = useState('');
        const [directPayments, setDirectPayments] = useState([]);
        
        const printableComponentRef = useRef();
      
        useEffect(() => {
          if (user && companies) {
            const userCompanyIds = user.company_ids?.map(access => access.company_id) || [];
            const accessibleCompanies = companies.filter(c => userCompanyIds.includes(c.id));
            
            if (user.is_admin) {
              setAllowedCompanies(companies);
              if (companies.length > 0 && !selectedCompany) setSelectedCompany(companies[0].id);
            } else {
              if (accessibleCompanies.length === 0) setHasAccess(false);
              else {
                setAllowedCompanies(accessibleCompanies);
                if (accessibleCompanies.length > 0 && !selectedCompany) setSelectedCompany(accessibleCompanies[0].id);
              }
            }
          }
        }, [user, companies, selectedCompany]);
      
        const totalConferido = useMemo(() => {
          const machineTotal = addedMachines.reduce((acc, am) => acc + am.payments.reduce((sum, p) => sum + p.value, 0), 0);
          const directTotal = directPayments.reduce((acc, dp) => acc + dp.value, 0);
          return machineTotal + directTotal;
        }, [addedMachines, directPayments]);

        const totalTaxas = useMemo(() => {
            return addedMachines.reduce((acc, am) => {
                return acc + am.payments.reduce((sum, p) => {
                    const feeValue = (p.value * (p.fee / 100)) + (p.taxa_adicional || 0);
                    return sum + feeValue;
                }, 0);
            }, 0);
        }, [addedMachines]);

        const totalLiquido = useMemo(() => totalConferido - totalTaxas, [totalConferido, totalTaxas]);
      
        const totalQuantidades = useMemo(() => {
          return (
            (parseInt(qtdBurgerDelivery) || 0) +
            (parseInt(qtdBurgerSalao) || 0) +
            (parseInt(qtdRodizio) || 0) +
            (parseInt(qtdRodizioMeia) || 0) +
            (parseInt(qtdPizzas) || 0)
          );
        }, [qtdBurgerDelivery, qtdBurgerSalao, qtdRodizio, qtdRodizioMeia, qtdPizzas]);
      
        const ticketMedio = useMemo(() => {
          if (totalQuantidades === 0) return 0;
          return totalConferido / totalQuantidades;
        }, [totalConferido, totalQuantidades]);
      
        const resetForm = useCallback(() => {
          setValorAbertura('');
          setSuprimentos('');
          setObservacoes('');
          setAddedMachines([]);
          setDirectPayments([]);
          setExpenses([]);
          setWithdrawals([]);
          setCourtesies([]);
          setSystemValues({});
          setQtdBurgerDelivery('');
          setQtdBurgerSalao('');
          setQtdRodizio('');
          setQtdRodizioMeia('');
          setQtdPizzas('');
          setValorDinheiro('');
          setValorIfoodOnline('');
          setValorPixCnpj('');
          setSelectedDate(new Date().toISOString().slice(0, 10));
          setSelectedSector('Salão');
          setView('main');
        }, []);
      
        const handleSave = async () => {
          if (!selectedCompany) {
            toast({ title: "⚠️ Atenção", description: "Selecione uma empresa.", variant: "destructive" });
            return;
          }
          if (!selectedSector) {
            toast({ title: "⚠️ Atenção", description: "Selecione um setor.", variant: "destructive" });
            return;
          }
          setIsLoading(true);
      
          const parsedValorAbertura = parseFloat(valorAbertura) || 0;
          const parsedSuprimentos = parseFloat(suprimentos) || 0;
      
          const totalSystem = Object.values(systemValues).reduce((sum, val) => sum + parseFloat(val), 0);
          const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.value, 0);
          const totalExpenses = expenses.reduce((sum, e) => sum + e.value, 0);
          const totalCourtesies = courtesies.reduce((sum, c) => sum + c.value, 0);
          const totalSaidas = totalWithdrawals + totalExpenses + totalCourtesies;
          const saldoFinal = (parsedValorAbertura + totalConferido + parsedSuprimentos) - totalSaidas;
      
          const uniquePaymentMethods = new Map();
          
          directPayments.forEach(dp => {
              uniquePaymentMethods.set(dp.name, {
                  name: dp.name,
                  conferred: dp.value,
                  sistema: systemValues[`payment-${dp.name}`] || 0,
                  details: [{ source: 'Direto', value: dp.value }]
              });
          });
      
          addedMachines.flatMap(am => am.payments.map(p => ({...p, machine: am.machine}))).forEach(p => {
              if (!uniquePaymentMethods.has(p.id)) {
                  uniquePaymentMethods.set(p.id, {
                      name: p.name,
                      conferred: 0,
                      sistema: systemValues[`payment-${p.id}`] || 0,
                      details: []
                  });
              }
              const method = uniquePaymentMethods.get(p.id);
              method.conferred += p.value;
              method.details.push({
                  source: `Máquina ${p.machine.serial_number}`,
                  value: p.value,
                  fee: p.fee,
                  taxa_adicional: p.taxa_adicional,
              });
          });
      
          const payment_details_final = Array.from(uniquePaymentMethods.values());
      
          const { data: closing, error: closingError } = await supabase.from('cash_closings').insert({
            company_id: selectedCompany,
            user_id: user.id,
            closing_date: selectedDate,
            setor: selectedSector,
            status: 'Pendente',
            payment_details: payment_details_final,
            total_calculated: totalSystem,
            total_conferred: totalConferido,
            total_difference: totalConferido - totalSystem,
            previous_balance: parsedValorAbertura,
            supplies: parsedSuprimentos,
            withdrawals: totalSaidas,
            valor_cortesia: totalCourtesies,
            final_balance: saldoFinal,
            observations: observacoes,
            qtd_burger_delivery: parseInt(qtdBurgerDelivery) || 0,
            qtd_burger_salao: parseInt(qtdBurgerSalao) || 0,
            qtd_rodizio: parseInt(qtdRodizio) || 0,
            qtd_rodizio_meia: parseInt(qtdRodizioMeia) || 0,
            qtd_pizzas: parseInt(qtdPizzas) || 0,
            ticket_medio: ticketMedio,
            total_taxas: totalTaxas,
            total_liquido: totalLiquido,
          }).select().single();
      
          if (closingError) {
            setIsLoading(false);
            toast({ title: "❌ Erro ao salvar fechamento", description: closingError.message, variant: "destructive" });
            return;
          }
      
          const allExpenses = [
            ...expenses.map(e => ({...e, group_name: 'Despesas Gerais'})),
            ...courtesies.map(c => ({...c, group_name: 'Cortesias'}))
          ];

          if (totalTaxas > 0) {
            allExpenses.push({
                description: 'Taxas de Cartão',
                value: totalTaxas,
                group_name: 'Taxas de Cartão'
            });
          }

          if (allExpenses.length > 0) {
            const { data: dreGroups } = await supabase.from('dre_groups').select('id, name');
            const dreGroupMap = new Map(dreGroups.map(g => [g.name, g.id]));

            const expensesToInsert = allExpenses.map(e => ({
              description: e.description, 
              value: e.value, 
              due_date: selectedDate, 
              payment_date: selectedDate, 
              status: 'paid', 
              company_id: selectedCompany, 
              dre_group_id: dreGroupMap.get(e.group_name),
            }));
            const { error: expenseInsertError } = await supabase.from('contas_pagar').insert(expensesToInsert);
            if (expenseInsertError) toast({ title: "Erro ao salvar despesas/taxas", description: expenseInsertError.message, variant: "destructive" });
          }
      
          if (withdrawals.length > 0) {
            const withdrawalsToInsert = withdrawals.map(w => ({
              company_id: selectedCompany, user_id: w.employee.id, value: w.value, date: selectedDate, cash_closing_id: closing.id,
            }));
            const { error: withdrawalInsertError } = await supabase.from('employee_withdrawals').insert(withdrawalsToInsert);
            if (withdrawalInsertError) toast({ title: "Erro ao salvar retiradas", description: withdrawalInsertError.message, variant: "destructive" });
          }
      
          setIsLoading(false);
          toast({ title: "✅ Enviado para Conferência!", description: "O fechamento de caixa foi salvo." });
          resetForm();
        };
      
        const handlePrint = () => { window.print(); };
      
        const handleShareWhatsApp = () => {
          const companyName = companies.find(c => c.id === parseInt(selectedCompany))?.name || 'N/A';
          const closingDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR');
          const formatCurrency = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;
      
          const parsedValorAbertura = parseFloat(valorAbertura) || 0;
          const parsedSuprimentos = parseFloat(suprimentos) || 0;
      
          const totalExpenses = expenses.reduce((sum, e) => sum + e.value, 0);
          const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.value, 0);
          const totalCourtesies = courtesies.reduce((sum, c) => sum + c.value, 0);
          const totalSaidas = totalExpenses + totalWithdrawals + totalCourtesies;
          const saldoFinal = (parsedValorAbertura + totalConferido + parsedSuprimentos) - totalSaidas;
          const totalSystem = Object.values(systemValues).reduce((sum, val) => sum + parseFloat(val), 0);
          const totalDifference = totalConferido - totalSystem;
      
          let text = `*Resumo do Fechamento de Caixa*\n\n`;
          text += `*Empresa:* ${companyName}\n`;
          text += `*Setor:* ${selectedSector}\n`;
          text += `*Data:* ${closingDate}\n`;
          text += `*Responsável:* ${user?.name || 'N/A'}\n`;
          text += `-----------------------------------\n`;
          text += `*ENTRADAS*\n`;
          text += `Valor Abertura: ${formatCurrency(parsedValorAbertura)}\n`;
          text += `Suprimentos: ${formatCurrency(parsedSuprimentos)}\n`;
      
          directPayments.forEach(dp => {
            text += `${dp.name}: ${formatCurrency(dp.value)}\n`;
          });
          
          addedMachines.forEach(({ machine, payments }) => {
            text += `\n*Máquina: ${machine.serial_number}*\n`;
            payments.forEach(p => {
              text += `${p.name}: ${formatCurrency(p.value)}\n`;
            });
          });
      
          text += `\n*Total Vendas:* ${formatCurrency(totalConferido)}\n`;
          text += `-----------------------------------\n`;
          text += `*VENDAS POR ITEM*\n`;
          text += `Burger (Delivery): ${parseInt(qtdBurgerDelivery) || 0}\n`;
          text += `Burger (Salão): ${parseInt(qtdBurgerSalao) || 0}\n`;
          text += `Rodízio: ${parseInt(qtdRodizio) || 0}\n`;
          text += `Rodízio (Meia): ${parseInt(qtdRodizioMeia) || 0}\n`;
          text += `Pizzas: ${parseInt(qtdPizzas) || 0}\n`;
          text += `*Total Itens:* ${totalQuantidades}\n`;
          text += `-----------------------------------\n`;
          text += `*SAÍDAS*\n`;
          expenses.forEach(e => { text += `Desp. ${e.description}: ${formatCurrency(e.value)}\n`; });
          courtesies.forEach(c => { text += `Cort. ${c.description}: ${formatCurrency(c.value)}\n`; });
          withdrawals.forEach(w => { text += `Ret. ${w.employee.name.split(' ')[0]}: ${formatCurrency(w.value)}\n`; });
          text += `\n*Total Saídas:* ${formatCurrency(totalSaidas)}\n`;
          text += `-----------------------------------\n`;
          text += `*RESUMO*\n`;
          text += `Total Conferido: ${formatCurrency(totalConferido)}\n`;
          text += `Total Sistema: ${formatCurrency(totalSystem)}\n`;
          text += `*Diferença:* ${formatCurrency(totalDifference)}\n`;
          text += `*SALDO FINAL:* ${formatCurrency(saldoFinal)}\n`;
          text += `*TICKET MÉDIO:* ${formatCurrency(ticketMedio)}\n`;
      
          if (observacoes) { text += `-----------------------------------\n*Observações:*\n${observacoes}\n`; }
      
          const encodedText = encodeURIComponent(text);
          window.open(`https://wa.me/?text=${encodedText}`, '_blank');
        };
      
        const handleMachineAdd = (data) => { setAddedMachines(prev => [...prev, data]); setView('main'); };
        const handleRemoveMachine = (machineId) => { setAddedMachines(prev => prev.filter(am => am.machine.id !== machineId)); };
        const handleExpenseAdd = (data) => { setExpenses(prev => [...prev, data]); setView('main'); };
        const handleRemoveExpense = (id) => { setExpenses(prev => prev.filter(e => e.id !== id)); };
        const handleWithdrawalAdd = (data) => { setWithdrawals(prev => [...prev, data]); setView('main'); };
        const handleRemoveWithdrawal = (id) => { setWithdrawals(prev => prev.filter(w => w.id !== id)); };
        const handleCourtesyAdd = (data) => { setCourtesies(prev => [...prev, data]); setView('main'); };
        const handleRemoveCourtesy = (id) => { setCourtesies(prev => prev.filter(c => c.id !== id)); };
      
        const handleSystemValueChange = (key, value) => {
          const newValue = parseFloat(value) || 0;
          setSystemValues(prev => ({ ...prev, [key]: newValue }));
        };
      
        const handleAddDirectPayments = () => {
          const newPayments = [];
          if (parseFloat(valorDinheiro) > 0) newPayments.push({ id: `dinheiro-${Date.now()}`, name: 'Dinheiro', value: parseFloat(valorDinheiro) });
          if (parseFloat(valorIfoodOnline) > 0) newPayments.push({ id: `ifood-${Date.now()}`, name: 'iFood Online', value: parseFloat(valorIfoodOnline) });
          if (parseFloat(valorPixCnpj) > 0) newPayments.push({ id: `pix-${Date.now()}`, name: 'Pix CNPJ', value: parseFloat(valorPixCnpj) });
      
          if (newPayments.length > 0) {
            setDirectPayments(prev => [...prev, ...newPayments]);
            setValorDinheiro('');
            setValorIfoodOnline('');
            setValorPixCnpj('');
            toast({ title: "Valores adicionados!" });
          } else {
            toast({ title: "Nenhum valor para adicionar", variant: "destructive" });
          }
        };
      
        const handleRemoveDirectPayment = (id) => {
          setDirectPayments(prev => prev.filter(p => p.id !== id));
        };
      
        if (!user || isLoading) {
          return (
            <div className="flex items-center justify-center h-full">
              <p>Carregando...</p>
            </div>
          );
        }
      
        if (!hasAccess) return <div className="p-8 text-center"><AlertTriangle className="mx-auto w-16 h-16 text-red-500" /><h2>Acesso Negado</h2></div>;
      
        const renderContent = () => {
          return (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="glass-effect rounded-xl p-4 sm:p-6 space-y-4">
                       <h3 className="font-bold text-lg">Movimentações do Caixa</h3>
                       <div className="flex items-center gap-4">
                         <label className="w-32">Abertura</label>
                         <div className="relative flex-grow"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span><Input type="number" value={valorAbertura} onChange={e => setValorAbertura(e.target.value)} className="pl-8" placeholder="0.00"/></div>
                       </div>
                       <div className="flex items-center gap-4">
                         <label className="w-32 text-green-600">Suprimentos</label>
                         <div className="relative flex-grow"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span><Input type="number" value={suprimentos} onChange={e => setSuprimentos(e.target.value)} className="pl-8" placeholder="0.00"/></div>
                       </div>
                       <div className="border-t pt-4 mt-4 space-y-3">
                          <div className="flex items-center gap-4">
                            <label className="w-32">Dinheiro</label>
                            <div className="relative flex-grow"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span><Input type="number" value={valorDinheiro} onChange={e => setValorDinheiro(e.target.value)} className="pl-8" placeholder="0.00"/></div>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="w-32">iFood Online</label>
                            <div className="relative flex-grow"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span><Input type="number" value={valorIfoodOnline} onChange={e => setValorIfoodOnline(e.target.value)} className="pl-8" placeholder="0.00"/></div>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="w-32">Pix CNPJ</label>
                            <div className="relative flex-grow"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span><Input type="number" value={valorPixCnpj} onChange={e => setValorPixCnpj(e.target.value)} className="pl-8" placeholder="0.00"/></div>
                          </div>
                          <Button onClick={handleAddDirectPayments} className="w-full mt-2 bg-indigo-500 hover:bg-indigo-600"><ArrowDownCircle className="mr-2 h-4 w-4"/> Adicionar aos Conferidos</Button>
                       </div>
                     </div>
                     <div className="glass-effect rounded-xl p-4 sm:p-6 space-y-2">
                        <h3 className="font-bold text-lg">Controle de Vendas</h3>
                         <div className="flex items-center gap-4"><label className="w-48 text-sm">Qtd. Hamb. (Delivery)</label><Input type="number" value={qtdBurgerDelivery} onChange={e => setQtdBurgerDelivery(e.target.value)} className="flex-grow" placeholder="0" /></div>
                         <div className="flex items-center gap-4"><label className="w-48 text-sm">Qtd. Hamb. (Salão)</label><Input type="number" value={qtdBurgerSalao} onChange={e => setQtdBurgerSalao(e.target.value)} className="flex-grow" placeholder="0" /></div>
                         <div className="flex items-center gap-4"><label className="w-48 text-sm">Qtd. Rodízio</label><Input type="number" value={qtdRodizio} onChange={e => setQtdRodizio(e.target.value)} className="flex-grow" placeholder="0" /></div>
                         <div className="flex items-center gap-4"><label className="w-48 text-sm">Qtd. Rodízio (Meia)</label><Input type="number" value={qtdRodizioMeia} onChange={e => setQtdRodizioMeia(e.target.value)} className="flex-grow" placeholder="0" /></div>
                         <div className="flex items-center gap-4"><label className="w-48 text-sm">Qtd. Pizzas</label><Input type="number" value={qtdPizzas} onChange={e => setQtdPizzas(e.target.value)} className="flex-grow" placeholder="0" /></div>
                     </div>
                  </div>
                   <div className="glass-effect rounded-xl p-4 sm:p-6"><h3 className="font-bold text-lg mb-4">Observações</h3><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="w-full p-3 rounded-lg border bg-background" /></div>
                </div>
                <div className="space-y-2">
                  <Button onClick={() => setView('addMachine')} className="w-full gradient-primary text-white"><Plus className="mr-2" /> Máquina</Button>
                  <Button onClick={() => setView('addExpense')} className="w-full bg-red-500 hover:bg-red-600 text-white"><ShoppingCart className="mr-2" /> Despesa</Button>
                  <Button onClick={() => setView('addCourtesy')} className="w-full bg-purple-500 hover:bg-purple-600 text-white"><Gift className="mr-2" /> Cortesia</Button>
                  <Button onClick={() => setView('addWithdrawal')} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"><UserMinus className="mr-2" /> Retirada</Button>
                </div>
              </div>
      
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <ConferidoSection directPayments={directPayments} addedMachines={addedMachines} addedOtherPayments={[]} onRemoveMachine={handleRemoveMachine} onRemoveOtherPayment={() => {}} onRemoveDirectPayment={handleRemoveDirectPayment} />
                <SistemaSection directPayments={directPayments} addedMachines={addedMachines} addedOtherPayments={[]} systemValues={systemValues} onSystemValueChange={handleSystemValueChange} />
              </div>
      
              <SaidasSection 
                expenses={expenses} 
                withdrawals={withdrawals}
                courtesies={courtesies} 
                onRemoveExpense={handleRemoveExpense} 
                onRemoveWithdrawal={handleRemoveWithdrawal} 
                onRemoveCourtesy={handleRemoveCourtesy}
              />
              
              <TotaisSection 
                directPayments={directPayments}
                addedMachines={addedMachines}
                addedOtherPayments={[]}
                expenses={expenses}
                withdrawals={withdrawals}
                courtesies={courtesies}
                systemValues={systemValues}
                valorAbertura={parseFloat(valorAbertura) || 0}
                suprimentos={parseFloat(suprimentos) || 0}
              />
      
               <div className="mt-6 glass-effect rounded-xl p-4 sm:p-6 text-center">
                   <h3 className="text-lg font-bold text-gray-700">Ticket Médio</h3>
                   <p className="text-3xl font-extrabold text-blue-600 mt-2">{ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                   <p className="text-sm text-muted-foreground mt-1">(Faturamento de {totalConferido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {totalQuantidades} itens)</p>
               </div>
      
              <div className="mt-6 flex flex-col sm:flex-row justify-end items-center gap-4">
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                  <Button onClick={handlePrint} className="flex-grow sm:flex-grow-0 bg-blue-500 hover:bg-blue-600 text-white font-bold" disabled={isLoading}><Printer className="mr-2" /> Imprimir/PDF</Button>
                  <Button onClick={handleShareWhatsApp} className="flex-grow sm:flex-grow-0 bg-green-500 hover:bg-green-600 text-white font-bold" disabled={isLoading}><MessageSquare className="mr-2" /> WhatsApp</Button>
                  <Button onClick={handleSave} className="flex-grow sm:flex-grow-0 bg-teal-500 hover:bg-teal-600 text-white font-bold" disabled={isLoading}><Save className="mr-2" /> {isLoading ? 'Enviando...' : 'Confirmar (F9)'}</Button>
                </div>
              </div>
            </>
          );
        };
      
        return (
          <div className="space-y-6 p-4">
            <div className="non-printable">
              <div className="glass-effect rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Empresa *</label>
                  <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full px-4 py-2 rounded-lg border bg-background" disabled={allowedCompanies.length <= 1 && !user.is_admin}>
                    {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data da Conferência</label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-4 py-2 rounded-lg border bg-background" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Setor *</label>
                  <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)} className="w-full px-4 py-2 rounded-lg border bg-background">
                    <option value="Salão">Salão</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                </div>
              </div>
              
              <motion.div
                key={view}
                initial={{ opacity: 0, x: view === 'main' ? -300 : 300 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 25 }}
                className="mt-6"
              >
                {view === 'main' ? renderContent() : (
                  view === 'addMachine' ? <AddMachineForm companyId={selectedCompany} onMachineAdd={handleMachineAdd} existingMachineIds={addedMachines.map(am => am.machine.id)} onCancel={() => setView('main')} /> :
                  view === 'addExpense' ? <AddExpenseForm onAdd={handleExpenseAdd} onCancel={() => setView('main')} /> :
                  view === 'addWithdrawal' ? <AddWithdrawalForm companyId={selectedCompany} onAdd={handleWithdrawalAdd} onCancel={() => setView('main')} /> :
                  view === 'addCourtesy' ? <AddCourtesyForm onAdd={handleCourtesyAdd} onCancel={() => setView('main')} /> : null
                )}
              </motion.div>
            </div>
            <div className="printable-only">
              <PrintableClosing
                ref={printableComponentRef}
                companyName={companies.find(c => c.id === parseInt(selectedCompany))?.name || ''}
                closingDate={selectedDate}
                user={user}
                data={{
                  directPayments,
                  addedMachines,
                  addedOtherPayments: [],
                  expenses,
                  withdrawals,
                  courtesies,
                  systemValues,
                  valorAbertura: parseFloat(valorAbertura) || 0,
                  suprimentos: parseFloat(suprimentos) || 0,
                  observacoes,
                  qtdBurgerDelivery,
                  qtdBurgerSalao,
                  qtdRodizio,
                  qtdRodizioMeia,
                  qtdPizzas,
                  ticketMedio,
                }}
              />
            </div>
          </div>
        );
    };
      
    export default Caixa;
  