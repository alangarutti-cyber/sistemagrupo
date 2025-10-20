
    import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Download, Save, Edit, Undo2, Trash2, CheckCircle, Search, FileText } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import {
      Dialog,
      DialogContent,
      DialogFooter,
      DialogHeader,
      DialogTitle,
    } from "@/components/ui/dialog"
    import {
      AlertDialog,
      AlertDialogAction,
      AlertDialogCancel,
      AlertDialogContent,
      AlertDialogDescription,
      AlertDialogFooter,
      AlertDialogHeader,
      AlertDialogTitle,
    } from "@/components/ui/alert-dialog"
    import { Input } from "@/components/ui/input"
    import { Label } from "@/components/ui/label"
    import { Checkbox } from "@/components/ui/checkbox"
    import { useUser } from '@/contexts/UserContext';
    import { useNavigate } from 'react-router-dom';

    const Financeiro = () => {
      const { user, companies, userCompanyAccess } = useUser();
      const navigate = useNavigate();
      const { toast } = useToast();
      const [activeTab, setActiveTab] = useState('pagar');
      const [selectedCompany, setSelectedCompany] = useState('all');
      const [contasPagar, setContasPagar] = useState([]);
      const [contasReceber, setContasReceber] = useState([]);
      const [dreGroups, setDreGroups] = useState([]);
      const [bankAccounts, setBankAccounts] = useState([]);
      const [clientes, setClientes] = useState([]);
      const [suppliers, setSuppliers] = useState([]);
      const [loading, setLoading] = useState(true);
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
      const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
      const [contaToProcess, setContaToProcess] = useState(null);
      const [contaToDelete, setContaToDelete] = useState(null);
      const [editingConta, setEditingConta] = useState(null);
      const [startDate, setStartDate] = useState('');
      const [endDate, setEndDate] = useState('');
      const [searchTerm, setSearchTerm] = useState('');
      const [selectedCliente, setSelectedCliente] = useState('all');
      const [selectedContas, setSelectedContas] = useState([]);
      const [newConta, setNewConta] = useState({
        description: '',
        value: '',
        due_date: '',
        company_id: '',
        installments: 1,
        is_recurring: false,
        dre_group_id: '',
        cliente_id: '',
        supplier_id: '',
      });

      const allowedCompanies = React.useMemo(() => {
        if (!user || !companies || !userCompanyAccess) return [];
        if (user.is_admin) return companies;
        const allowedCompanyIds = userCompanyAccess
          .filter(access => access.user_id === user.id)
          .map(access => access.company_id);
        return companies.filter(c => allowedCompanyIds.includes(c.id));
      }, [user, companies, userCompanyAccess]);
      
      const allowedCompanyIds = allowedCompanies.map(c => c.id);

      const fetchInitialData = useCallback(async () => {
        setLoading(true);
        setSelectedContas([]);
        
        const fetchContas = async (tableName) => {
          let selectString = '*, companies(name), dre_groups(name)';
          if (tableName === 'contas_pagar') {
            selectString += ', supplier:suppliers(name), bank_account:bank_accounts!contas_pagar_bank_account_id_fkey(bank_name, account_number)';
          } else { // contas_receber
            selectString += ', cliente:clientes(name, id), bank_account:bank_accounts!contas_receber_conta_id_fkey(bank_name, account_number)';
          }

          let query = supabase.from(tableName).select(selectString);
          
          if (selectedCompany !== 'all') {
            query = query.eq('company_id', selectedCompany);
          } else {
            query = query.in('company_id', allowedCompanyIds);
          }
          if (startDate) query = query.gte('due_date', startDate);
          if (endDate) query = query.lte('due_date', endDate);
          if (searchTerm) query = query.ilike('description', `%${searchTerm}%`);
          if (tableName === 'contas_receber' && selectedCliente !== 'all') {
            query = query.eq('cliente_id', selectedCliente);
          }
          
          const { data, error } = await query.order('due_date', { ascending: true });
          if (error) {
            console.error(`Erro ao buscar ${tableName}:`, error);
            toast({ title: `Erro ao buscar ${tableName}`, description: error.message, variant: "destructive" });
          }
          return data || [];
        };

        const fetchDreGroups = async () => {
            const { data, error } = await supabase.from('dre_groups').select('*').eq('is_calculated', false);
            if (error) toast({ title: "Erro ao buscar grupos de DRE", variant: "destructive" });
            return data || [];
        };

        const fetchBankAccounts = async () => {
            let query = supabase.from('bank_accounts').select('*, companies:bank_account_company_access!inner(company_id)');
            if (selectedCompany !== 'all') query = query.eq('companies.company_id', selectedCompany);
            else query = query.in('companies.company_id', allowedCompanyIds);
            const { data, error } = await query;
            if (error) {
                toast({ title: "Erro ao buscar contas bancárias", variant: "destructive", description: error.message });
                return [];
            }
            return data.reduce((acc, current) => {
                if (!acc.find(item => item.id === current.id)) acc.push(current);
                return acc;
            }, []);
        };

        const fetchClientes = async () => {
            const { data, error } = await supabase.from('clientes').select('id, name');
            if (error) toast({ title: "Erro ao buscar clientes", variant: "destructive" });
            return data || [];
        };
        
        const fetchSuppliers = async () => {
            const { data, error } = await supabase.from('suppliers').select('id, name');
            if (error) toast({ title: "Erro ao buscar fornecedores", variant: "destructive" });
            return data || [];
        };

        const [pagarData, receberData, dreData, banksData, clientesData, suppliersData] = await Promise.all([
            fetchContas('contas_pagar'), 
            fetchContas('contas_receber'),
            fetchDreGroups(),
            fetchBankAccounts(),
            fetchClientes(),
            fetchSuppliers()
        ]);
        
        const today = new Date().toISOString().split('T')[0];
        
        const processContas = (data) => data.map(c => ({
          ...c,
          status: c.status === 'Pendente' && c.due_date < today ? 'Vencida' : c.status,
          company: c.companies?.name || 'Empresa não encontrada'
        }));

        setContasPagar(processContas(pagarData));
        setContasReceber(processContas(receberData));
        setDreGroups(dreData);
        setBankAccounts(banksData);
        setClientes(clientesData);
        setSuppliers(suppliersData);

        setLoading(false);
      }, [selectedCompany, toast, JSON.stringify(allowedCompanyIds), startDate, endDate, searchTerm, selectedCliente]);

      useEffect(() => {
        if (allowedCompanyIds.length > 0) {
          fetchInitialData();
        } else if (!loading) {
          setLoading(false);
        }
      }, [fetchInitialData, allowedCompanyIds.length]);

      useEffect(() => {
        setSelectedContas([]);
      }, [activeTab]);

      const handleInputChange = (e) => {
        const { id, value, type, checked } = e.target;
        const stateToUpdate = editingConta ? setEditingConta : setNewConta;
        stateToUpdate(prev => ({ ...prev, [id]: type === 'checkbox' ? checked : value }));
      };

      const handleSaveConta = async () => {
        const contaData = editingConta || newConta;
        if (!contaData.description || !contaData.value || !contaData.due_date || !contaData.company_id) {
          toast({ title: "Campos obrigatórios", variant: "destructive" });
          return;
        }

        const tableName = activeTab === 'pagar' ? 'contas_pagar' : 'contas_receber';
        
        const dataToUpsert = {
            description: contaData.description,
            value: parseFloat(contaData.value),
            due_date: contaData.due_date,
            company_id: contaData.company_id,
            dre_group_id: contaData.dre_group_id || null,
        };

        if (tableName === 'contas_pagar') {
            dataToUpsert.supplier_id = contaData.supplier_id || null;
        } else {
            dataToUpsert.cliente_id = contaData.cliente_id || null;
        }

        if (editingConta) {
            const { error } = await supabase.from(tableName).update(dataToUpsert).eq('id', editingConta.id);
            if (error) toast({ title: "Erro ao atualizar conta", variant: "destructive" });
            else { toast({ title: "Conta atualizada!", variant: "success" }); closeDialog(); fetchInitialData(); }
        } else {
            const installments = parseInt(newConta.installments, 10) || 1;
            const valuePerInstallment = parseFloat(newConta.value) / installments;
            const initialDate = new Date(newConta.due_date + 'T00:00:00');

            const contasToInsert = Array.from({ length: installments }, (_, i) => {
                const dueDate = new Date(initialDate);
                dueDate.setMonth(initialDate.getMonth() + i);
                return {
                    ...dataToUpsert,
                    description: `${newConta.description} ${installments > 1 ? `(${i + 1}/${installments})` : ''}`,
                    value: valuePerInstallment,
                    due_date: dueDate.toISOString().split('T')[0],
                    is_recurring: newConta.is_recurring,
                    installments: installments,
                    status: 'Pendente',
                };
            });

            const { error: insertError } = await supabase.from(tableName).insert(contasToInsert).select();
            if (insertError) {
              toast({ title: `Erro ao adicionar conta`, variant: "destructive", description: insertError.message });
              return;
            }

            toast({ title: `Conta(s) adicionada(s)!`, variant: "success" });
            closeDialog(); 
            fetchInitialData();
        }
      };

      const handleStatusChange = async (conta, newStatus, bankAccountId) => {
        const tableName = activeTab === 'pagar' ? 'contas_pagar' : 'contas_receber';
        const isConfirming = newStatus === 'Paga' || newStatus === 'Recebida';
        const isUndoing = newStatus === 'Pendente';
        const fieldToUpdate = tableName === 'contas_pagar' ? 'payment_date' : 'data_recebimento';
        const accountFieldToUpdate = tableName === 'contas_pagar' ? 'bank_account_id' : 'conta_id';

        const updateData = {
            status: newStatus,
            [fieldToUpdate]: isConfirming ? new Date().toISOString().split('T')[0] : null,
            [accountFieldToUpdate]: isConfirming ? (bankAccountId || null) : null
        };

        const { error } = await supabase.from(tableName).update(updateData).eq('id', conta.id);

        if (error) {
            toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
            return;
        }

        if (isConfirming) {
            if (bankAccountId) {
                const { data: bankAccount, error: accError } = await supabase.from('bank_accounts').select('current_balance').eq('id', bankAccountId).single();
                if (accError) {
                  toast({ title: "Erro ao buscar conta bancária", description: accError.message, variant: "destructive" });
                } else {
                  const transactionType = activeTab === 'pagar' ? 'outflow' : 'inflow';
                  const newBalance = transactionType === 'inflow' ? bankAccount.current_balance + conta.value : bankAccount.current_balance - conta.value;

                  await supabase.from('bank_transactions').insert({
                      account_id: bankAccountId,
                      type: transactionType,
                      value: conta.value,
                      description: `Ref: ${conta.description}`,
                      transaction_date: new Date().toISOString().split('T')[0],
                      user_id: user.id,
                      [tableName === 'contas_pagar' ? 'conta_pagar_id' : 'conta_receber_id']: conta.id
                  });
                  await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', bankAccountId);
                }
            }
            toast({ title: "Status atualizado!", variant: "success" });
        } else if (isUndoing) {
            const originalAccountId = conta.bank_account_id || conta.conta_id;
            if (originalAccountId) {
                const { data: bankAccount, error: accError } = await supabase.from('bank_accounts').select('current_balance').eq('id', originalAccountId).single();
                if (accError) {
                  toast({ title: "Erro ao buscar conta bancária para estorno", description: accError.message, variant: "destructive" });
                } else {
                  const transactionType = activeTab === 'pagar' ? 'outflow' : 'inflow';
                  const newBalance = transactionType === 'inflow' ? bankAccount.current_balance - conta.value : bankAccount.current_balance + conta.value;
                  
                  await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', originalAccountId);
                  
                  await supabase.from('bank_transactions').delete().match({ [tableName === 'contas_pagar' ? 'conta_pagar_id' : 'conta_receber_id']: conta.id });
                }
            }
            toast({ title: "Operação desfeita com sucesso!", variant: "success" });
        }

        fetchInitialData();
        setIsPaymentDialogOpen(false);
        setContaToProcess(null);
      };

      const handleDeleteConta = async () => {
        if (!contaToDelete) return;
        const tableName = activeTab === 'pagar' ? 'contas_pagar' : 'contas_receber';
        const { error } = await supabase.from(tableName).delete().eq('id', contaToDelete.id);
        if (error) toast({ title: "Erro ao excluir conta", variant: "destructive" });
        else { toast({ title: "Conta excluída!", variant: "success" }); fetchInitialData(); }
        setIsDeleteDialogOpen(false);
        setContaToDelete(null);
      };

      const handleSelectConta = (contaId, checked) => {
        if (checked) {
          setSelectedContas(prev => [...prev, contaId]);
        } else {
          setSelectedContas(prev => prev.filter(id => id !== contaId));
        }
      };

      const handleGenerateSingleCobranca = async () => {
        if (selectedContas.length === 0) {
            toast({ title: "Nenhuma conta selecionada", variant: 'destructive' });
            return;
        }

        const contasParaCobranca = contasReceber.filter(c => selectedContas.includes(c.id));
        const firstConta = contasParaCobranca[0];
        const clienteId = firstConta.cliente_id;
        const companyId = firstConta.company_id;

        if (!contasParaCobranca.every(c => c.cliente_id === clienteId && c.company_id === companyId)) {
            toast({ title: "Seleção Inválida", description: "Todas as contas selecionadas devem ser do mesmo cliente e da mesma empresa.", variant: 'destructive' });
            return;
        }

        const totalValue = contasParaCobranca.reduce((sum, c) => sum + c.value, 0);
        const lastDueDate = contasParaCobranca.reduce((latest, c) => c.due_date > latest ? c.due_date : latest, firstConta.due_date);
        
        const { data: cobranca, error } = await supabase
            .from('cobrancas')
            .insert({
                cliente_id: clienteId,
                company_id: companyId,
                valor: totalValue,
                data_emissao: new Date().toISOString().split('T')[0],
                data_vencimento: lastDueDate,
                status: 'pendente',
                observacoes: `Cobrança unificada de ${contasParaCobranca.length} conta(s). IDs: ${selectedContas.join(', ')}`,
                responsavel_id: user.id,
                contas_receber_id: firstConta.id, // Link to the first one for reference
            })
            .select()
            .single();

        if (error) {
            toast({ title: "Erro ao gerar cobrança", description: error.message, variant: 'destructive' });
        } else {
            toast({ title: "Cobrança unificada gerada!", description: "Você será redirecionado para a tela de cobranças.", variant: 'success' });
            setSelectedContas([]);
            navigate('/cobrancas');
        }
    };


      const openEditDialog = (conta) => { setEditingConta({ ...conta, due_date: conta.due_date.split('T')[0] }); setIsDialogOpen(true); };
      const openDeleteDialog = (conta) => { setContaToDelete(conta); setIsDeleteDialogOpen(true); };
      const openNewDialog = () => { setEditingConta(null); setNewConta({ description: '', value: '', due_date: '', company_id: '', installments: 1, is_recurring: false, dre_group_id: '', cliente_id: '', supplier_id: '' }); setIsDialogOpen(true); };
      const openPaymentDialog = (conta) => { setContaToProcess(conta); setIsPaymentDialogOpen(true); };
      const closeDialog = () => { setIsDialogOpen(false); setEditingConta(null); };
      
      const renderTableRows = (contas, type) => {
        if (contas.length === 0) {
          return (
            <tr>
              <td colSpan="8" className="text-center p-10 text-gray-500">Nenhuma conta encontrada.</td>
            </tr>
          );
        }
        return contas.map(conta => {
          const isOverdue = conta.status === 'Vencida';
          const isPaid = conta.status === 'Recebida' || conta.status === 'Paga';
          const entityName = type === 'pagar' ? conta.supplier?.name : conta.cliente?.name;

          return (
            <tr key={conta.id} className={`border-b ${selectedContas.includes(conta.id) ? 'bg-blue-50' : (isPaid ? 'bg-green-50' : isOverdue ? 'bg-red-50' : 'bg-white')}`}>
               {type === 'receber' && (
                 <td className="p-3 text-center">
                   <Checkbox
                     checked={selectedContas.includes(conta.id)}
                     onCheckedChange={(checked) => handleSelectConta(conta.id, checked)}
                     disabled={conta.status !== 'Pendente' && conta.status !== 'Vencida'}
                   />
                 </td>
               )}
              <td className="p-3">
                <p className="font-semibold">{conta.description}</p>
                <p className="text-xs text-gray-500">{conta.company}</p>
              </td>
              <td className="p-3 text-left">{entityName || 'N/A'}</td>
              <td className="p-3 text-right font-mono">R$ {parseFloat(conta.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td className={`p-3 text-center font-medium ${isOverdue ? 'text-red-600' : ''}`}>{new Date(conta.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
              <td className="p-3 text-center">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${isOverdue ? 'bg-red-100 text-red-700' : isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {conta.status}
                </span>
              </td>
              <td className="p-3 text-center">{conta.payment_date || conta.data_recebimento ? new Date((conta.payment_date || conta.data_recebimento) + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
              <td className="p-3">
                <div className="flex justify-center gap-1">
                  {isPaid ? (
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange(conta, 'Pendente')}><Undo2 className="w-4 h-4 mr-1" /> Desfazer</Button>
                  ) : (
                    <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => openPaymentDialog(conta)}><CheckCircle className="w-4 h-4 mr-1" /> Confirmar</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEditDialog(conta)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(conta)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </td>
            </tr>
          );
        });
      };

      const contaData = editingConta || newConta;

      return (
        <div className="space-y-6">
          <div className="bg-card p-4 rounded-xl shadow-md border">
            <h1 className="text-2xl font-bold mb-4">Gestão Financeira</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <Label htmlFor="company-filter">Empresa</Label>
                <select id="company-filter" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full px-4 py-2 rounded-lg border bg-background h-10" disabled={loading}>
                  <option value="all">Todas as Empresas</option>
                  {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {activeTab === 'receber' && (
                <div>
                  <Label htmlFor="client-filter">Cliente</Label>
                  <select id="client-filter" value={selectedCliente} onChange={(e) => setSelectedCliente(e.target.value)} className="w-full px-4 py-2 rounded-lg border bg-background h-10" disabled={loading}>
                    <option value="all">Todos os Clientes</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <Label htmlFor="start-date">Vencimento (Início)</Label>
                <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={loading}/>
              </div>
              <div>
                <Label htmlFor="end-date">Vencimento (Fim)</Label>
                <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={loading}/>
              </div>
              <div className={activeTab === 'receber' ? 'lg:col-span-1' : 'lg:col-span-2'}>
                 <Label htmlFor="search-term">Buscar por Descrição</Label>
                 <div className="flex items-end gap-2">
                     <Input id="search-term" type="text" placeholder="Ex: Compra de insumos" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} disabled={loading}/>
                     <Button onClick={fetchInitialData} className="h-10" disabled={loading}><Search className="w-4 h-4" /></Button>
                 </div>
              </div>
            </div>
             <div className="flex justify-end gap-2 mt-4">
                 <Button onClick={openNewDialog} className="h-10" variant="outline"><Plus className="mr-2 h-4 w-4" /> Nova Conta</Button>
                 <Button variant="outline" size="icon" className="h-10 w-10"><Download className="w-4 h-4" /></Button>
             </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
            <DialogContent><DialogHeader><DialogTitle>{editingConta ? 'Editar' : 'Nova'} Conta</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <Input id="description" placeholder="Descrição" value={contaData.description} onChange={handleInputChange} />
                <div className="grid grid-cols-2 gap-4">
                  <Input id="value" type="number" placeholder="Valor Total (R$)" value={contaData.value} onChange={handleInputChange} />
                  <Input id="due_date" type="date" placeholder="1º Vencimento" value={contaData.due_date} onChange={handleInputChange} />
                </div>
                <select id="company_id" value={contaData.company_id} onChange={handleInputChange} className="w-full p-2 border rounded"><option value="" disabled>Selecione uma empresa</option>{allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                {activeTab === 'receber' ? (
                    <select id="cliente_id" value={contaData.cliente_id || ''} onChange={handleInputChange} className="w-full p-2 border rounded"><option value="">Nenhum Cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                ) : (
                    <select id="supplier_id" value={contaData.supplier_id || ''} onChange={handleInputChange} className="w-full p-2 border rounded"><option value="">Nenhum Fornecedor</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                )}
                <select id="dre_group_id" value={contaData.dre_group_id || ''} onChange={handleInputChange} className="w-full p-2 border rounded"><option value="">Nenhum Grupo DRE</option>{dreGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                {!editingConta && <div className="grid grid-cols-2 gap-4"><Input id="installments" type="number" min="1" placeholder="Nº de Parcelas" value={newConta.installments} onChange={handleInputChange} /><div className="flex items-center space-x-2"><Checkbox id="is_recurring" checked={newConta.is_recurring} onCheckedChange={(c) => setNewConta(p => ({...p, is_recurring: c}))} /><Label htmlFor="is_recurring">É recorrente?</Label></div></div>}
              </div>
              <DialogFooter><Button onClick={handleSaveConta}><Save className="mr-2" /> Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Confirmar {activeTab === 'pagar' ? 'Pagamento' : 'Recebimento'}</DialogTitle></DialogHeader>
              <div className="py-4 space-y-4">
                <p>Selecione a conta bancária para esta transação. O saldo será atualizado automaticamente.</p>
                <select id="bank_account_id" className="w-full p-2 border rounded" onChange={e => setContaToProcess(p => ({...p, bank_account_id: e.target.value}))}>
                  <option value="">Não vincular / Caixa</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name} / {b.account_number}</option>)}
                </select>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => handleStatusChange(contaToProcess, activeTab === 'pagar' ? 'Paga' : 'Recebida', contaToProcess.bank_account_id)}><CheckCircle className="mr-2" /> Confirmar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita e excluirá permanentemente a conta "{contaToDelete?.description}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConta}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
          
          <div className="bg-card rounded-xl shadow-md border overflow-hidden">
            <div className="p-2 bg-muted/50 flex justify-between items-center">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveTab('pagar')} className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${activeTab === 'pagar' ? 'bg-white shadow' : 'text-muted-foreground hover:bg-white/50'}`}>Contas a Pagar</button>
                <button onClick={() => setActiveTab('receber')} className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${activeTab === 'receber' ? 'bg-white shadow' : 'text-muted-foreground hover:bg-white/50'}`}>Contas a Receber</button>
              </div>
              {activeTab === 'receber' && selectedContas.length > 0 && (
                 <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="pr-4">
                    <Button onClick={handleGenerateSingleCobranca}>
                       <FileText className="h-4 w-4 mr-2" />
                       Gerar Cobrança Única ({selectedContas.length})
                    </Button>
                 </motion.div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                    <tr>
                      {activeTab === 'receber' && <th className="p-3 w-12"></th>}
                      <th className="p-3 text-left font-semibold text-gray-600">Descrição</th>
                      <th className="p-3 text-left font-semibold text-gray-600">Cliente/Fornecedor</th>
                      <th className="p-3 text-right font-semibold text-gray-600">Valor</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Vencimento</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Status</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Data Pgto/Rec.</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="text-center p-10">Carregando...</td>
                      </tr>
                    ) : (
                      activeTab === 'pagar' ? renderTableRows(contasPagar, 'pagar') : renderTableRows(contasReceber, 'receber')
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    };

    export default Financeiro;
  