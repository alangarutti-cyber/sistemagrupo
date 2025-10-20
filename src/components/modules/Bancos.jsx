import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Plus, Edit, Trash2, Save, X, ArrowRightLeft, ArrowUpCircle, ArrowDownCircle, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useOutletContext } from 'react-router-dom';

const formatCurrency = (value) => `R$ ${parseFloat(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Bancos = () => {
    const { user, companies, onDataUpdate, userCompanyAccess } = useOutletContext();
    const { toast } = useToast();
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCompany, setSelectedCompany] = useState('all');
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
    const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [transactionData, setTransactionData] = useState({});
    const [transferData, setTransferData] = useState({});
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState(null);

    const allowedCompanies = React.useMemo(() => {
      if (!user || !companies) return [];
      if (user.is_admin) return companies;
      const allowedCompanyIds = userCompanyAccess?.map(access => access.company_id) || [];
      return companies.filter(c => allowedCompanyIds.includes(c.id));
    }, [user, companies, userCompanyAccess]);

    const allowedCompanyIds = React.useMemo(() => allowedCompanies.map(c => c.id), [allowedCompanies]);

    const fetchData = useCallback(async () => {
      setLoading(true);
      
      let query = supabase.from('bank_accounts').select('*, companies:bank_account_company_access(company_id, companies(name))');

      if (selectedCompany !== 'all') {
        const { data: accessData, error: accessError } = await supabase.from('bank_account_company_access').select('bank_account_id').eq('company_id', selectedCompany);
        if (accessError) {
            toast({ title: "Erro ao buscar permissões", variant: "destructive" });
            setAccounts([]);
            setLoading(false);
            return;
        }
        const accountIds = accessData.map(a => a.bank_account_id);
        query = query.in('id', accountIds);
      } else {
          const { data: accessData, error: accessError } = await supabase.from('bank_account_company_access').select('bank_account_id').in('company_id', allowedCompanyIds);
          if (accessError) {
            toast({ title: "Erro ao buscar permissões", variant: "destructive" });
            setAccounts([]);
            setLoading(false);
            return;
          }
          const accountIds = accessData.map(a => a.bank_account_id);
          if (accountIds.length === 0) {
            setAccounts([]);
            setLoading(false);
            return;
          }
          query = query.in('id', accountIds);
      }

      const { data, error } = await query.order('bank_name');
      
      if (error) {
        toast({ title: "Erro ao buscar contas", variant: "destructive" });
      } else {
        const formattedData = data.map(acc => ({
          ...acc,
          accessible_companies: acc.companies.map(c => c.companies?.name).filter(Boolean).join(', ')
        }));
        setAccounts(formattedData);
      }
      setLoading(false);
    }, [selectedCompany, toast, JSON.stringify(allowedCompanyIds)]);

    const fetchTransactions = useCallback(async () => {
      if (!selectedAccount) {
        setTransactions([]);
        return;
      }
      const { data, error } = await supabase.from('bank_transactions').select('*').eq('account_id', selectedAccount.id).order('transaction_date', { ascending: false });
      if (error) toast({ title: "Erro ao buscar transações", variant: "destructive" });
      else setTransactions(data);
    }, [selectedAccount, toast]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const handleSaveAccount = async () => {
      const { accessible_companies, ...accountData } = editingAccount;
      const account = {
        ...accountData,
        initial_balance: parseFloat(accountData.initial_balance) || 0,
        current_balance: accountData.id ? accountData.current_balance : (parseFloat(accountData.initial_balance) || 0),
      };
      
      delete account.companies;

      const { data: savedAccount, error } = await supabase.from('bank_accounts').upsert(account).select().single();

      if (error) {
        toast({ title: "Erro ao salvar conta", variant: "destructive" });
        return;
      }

      const { error: deleteAccessError } = await supabase.from('bank_account_company_access').delete().eq('bank_account_id', savedAccount.id);
      if (deleteAccessError) {
        toast({ title: "Erro ao atualizar permissões", variant: "destructive" });
        return;
      }

      const accessData = accessible_companies.map(companyId => ({ bank_account_id: savedAccount.id, company_id: companyId }));
      if (accessData.length > 0) {
        const { error: insertAccessError } = await supabase.from('bank_account_company_access').insert(accessData);
        if (insertAccessError) {
          toast({ title: "Erro ao salvar permissões", variant: "destructive" });
          return;
        }
      }

      toast({ title: "Conta salva com sucesso!", variant: "success" });
      setIsAccountDialogOpen(false);
      fetchData();
      onDataUpdate();
    };
    
     const handleDeleteAccount = async () => {
      if (!accountToDelete) return;
  
      const { error: transactionsError } = await supabase.from('bank_transactions').delete().eq('account_id', accountToDelete.id);
      if (transactionsError) {
          toast({ title: "Erro ao excluir transações associadas", description: transactionsError.message, variant: "destructive" });
          setIsDeleteAlertOpen(false);
          return;
      }

      const { error: accessError } = await supabase.from('bank_account_company_access').delete().eq('bank_account_id', accountToDelete.id);
      if (accessError) {
          toast({ title: "Erro ao excluir permissões associadas", description: accessError.message, variant: "destructive" });
          setIsDeleteAlertOpen(false);
          return;
      }
  
      const { error: accountError } = await supabase.from('bank_accounts').delete().eq('id', accountToDelete.id);
      if (accountError) {
          toast({ title: "Erro ao excluir conta", description: accountError.message, variant: "destructive" });
      } else {
          toast({ title: "Conta excluída com sucesso!" });
          fetchData();
          setSelectedAccount(null);
          onDataUpdate();
      }
  
      setIsDeleteAlertOpen(false);
      setAccountToDelete(null);
  };

    const handleSaveTransaction = async () => {
      const { error: transactionError } = await supabase.from('bank_transactions').insert({
        ...transactionData,
        account_id: selectedAccount.id,
        value: parseFloat(transactionData.value),
        user_id: user.id,
      });

      if (transactionError) {
        toast({ title: "Erro ao salvar transação", variant: "destructive" });
        return;
      }

      const newBalance = transactionData.type === 'inflow'
        ? selectedAccount.current_balance + parseFloat(transactionData.value)
        : selectedAccount.current_balance - parseFloat(transactionData.value);

      const { error: balanceError } = await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', selectedAccount.id);

      if (balanceError) toast({ title: "Erro ao atualizar saldo", variant: "destructive" });
      else {
        toast({ title: "Transação salva!", variant: "success" });
        setIsTransactionDialogOpen(false);
        fetchData();
        fetchTransactions();
        setSelectedAccount(prev => ({ ...prev, current_balance: newBalance }));
        onDataUpdate();
      }
    };

    const handleSaveTransfer = async () => {
      const { from_account_id, to_account_id, value, description, transaction_date } = transferData;
      const transferValue = parseFloat(value);

      const { data: fromAccount, error: fromError } = await supabase.from('bank_accounts').select('current_balance').eq('id', from_account_id).single();
      const { data: toAccount, error: toError } = await supabase.from('bank_accounts').select('current_balance').eq('id', to_account_id).single();

      if (fromError || toError) {
        toast({ title: "Erro ao buscar contas para transferência", variant: "destructive" });
        return;
      }

      const { data: outflow, error: outflowError } = await supabase.from('bank_transactions').insert({
        account_id: from_account_id, type: 'transfer_out', value: transferValue, description, transaction_date, user_id: user.id
      }).select().single();

      if (outflowError) {
        toast({ title: "Erro na saída da transferência", variant: "destructive" });
        return;
      }

      const { error: inflowError } = await supabase.from('bank_transactions').insert({
        account_id: to_account_id, type: 'transfer_in', value: transferValue, description, transaction_date, user_id: user.id, related_transaction_id: outflow.id
      });

      if (inflowError) {
        toast({ title: "Erro na entrada da transferência", variant: "destructive" });
        return;
      }

      await supabase.from('bank_accounts').update({ current_balance: fromAccount.current_balance - transferValue }).eq('id', from_account_id);
      await supabase.from('bank_accounts').update({ current_balance: toAccount.current_balance + transferValue }).eq('id', to_account_id);

      toast({ title: "Transferência realizada com sucesso!", variant: "success" });
      setIsTransferDialogOpen(false);
      fetchData();
      if (selectedAccount?.id === from_account_id || selectedAccount?.id === to_account_id) {
        fetchTransactions();
      }
      onDataUpdate();
    };

    const openAccountDialog = async (account = null) => {
      if (account) {
        const { data, error } = await supabase.from('bank_account_company_access').select('company_id').eq('bank_account_id', account.id);
        if (error) {
          toast({ title: "Erro ao buscar permissões da conta", variant: "destructive" });
          return;
        }
        setEditingAccount({ ...account, accessible_companies: data.map(d => d.company_id) });
      } else {
        setEditingAccount({ start_date: new Date().toISOString().slice(0, 10), accessible_companies: [] });
      }
      setIsAccountDialogOpen(true);
    };

    const openTransactionDialog = (type) => {
      setTransactionData({ type, transaction_date: new Date().toISOString().slice(0, 10) });
      setIsTransactionDialogOpen(true);
    };

    const openTransferDialog = () => {
      setTransferData({ from_account_id: selectedAccount?.id, transaction_date: new Date().toISOString().slice(0, 10) });
      setIsTransferDialogOpen(true);
    };
    
    const openDeleteDialog = (account) => {
      setAccountToDelete(account);
      setIsDeleteAlertOpen(true);
    };

    const handleCompanyAccessChange = (companyId) => {
      setEditingAccount(prev => {
        const accessible_companies = prev.accessible_companies.includes(companyId)
          ? prev.accessible_companies.filter(id => id !== companyId)
          : [...prev.accessible_companies, companyId];
        return { ...prev, accessible_companies };
      });
    };

    if (!user) {
      return <div>Carregando informações do usuário...</div>;
    }

    return (
      <div className="space-y-6 p-4 sm:p-0">
        <div className="glass-effect rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <Label>Filtrar por Empresa</Label>
            <select value={selectedCompany} onChange={(e) => { setSelectedCompany(e.target.value); setSelectedAccount(null); }} className="w-full px-4 py-2 rounded-lg border">
              <option value="all">Todas as Empresas</option>
              {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openAccountDialog()} className="flex-1 gradient-primary text-white"><Plus className="mr-2" /> Nova Conta</Button>
            <Button onClick={openTransferDialog} className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"><ArrowRightLeft className="mr-2" /> Transferir</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            {loading ? <p>Carregando contas...</p> : accounts.map(acc => (
              <motion.div key={acc.id} onClick={() => setSelectedAccount(acc)}
                className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${selectedAccount?.id === acc.id ? 'border-red-500 bg-red-50' : 'border-transparent bg-white shadow-md hover:shadow-lg'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{acc.bank_name}</h3>
                    <p className="text-sm text-gray-500">Ag: {acc.agency} / C: {acc.account_number}</p>
                    <p className="text-xs text-gray-400 mt-1">Acesso: {acc.accessible_companies}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => openAccountDialog(acc)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); openDeleteDialog(acc); }}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-2xl font-bold mt-2">{formatCurrency(acc.current_balance)}</p>
              </motion.div>
            ))}
          </div>

          <div className="lg:col-span-2">
            {selectedAccount ? (
              <div className="glass-effect rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Extrato: {selectedAccount.bank_name}</h2>
                  <div className="flex gap-2">
                    <Button onClick={() => openTransactionDialog('inflow')} size="sm" className="bg-green-500 hover:bg-green-600 text-white"><ArrowUpCircle className="mr-2" /> Entrada</Button>
                    <Button onClick={() => openTransactionDialog('outflow')} size="sm" className="bg-red-500 hover:bg-red-600 text-white"><ArrowDownCircle className="mr-2" /> Saída</Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {transactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold">{t.description || 'Transação'}</p>
                        <p className="text-sm text-gray-500">{new Date(t.transaction_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                      </div>
                      <p className={`font-bold ${t.type.includes('in') ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type.includes('in') ? '+' : '-'} {formatCurrency(t.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="flex items-center justify-center h-full glass-effect rounded-xl"><p className="text-gray-500">Selecione uma conta para ver o extrato.</p></div>}
          </div>
        </div>

        <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingAccount?.id ? 'Editar' : 'Nova'} Conta Bancária</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Nome do Banco" value={editingAccount?.bank_name || ''} onChange={e => setEditingAccount(p => ({ ...p, bank_name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Agência" value={editingAccount?.agency || ''} onChange={e => setEditingAccount(p => ({ ...p, agency: e.target.value }))} />
                <Input placeholder="Conta" value={editingAccount?.account_number || ''} onChange={e => setEditingAccount(p => ({ ...p, account_number: e.target.value }))} />
              </div>
              <Input placeholder="Tipo de Conta (Corrente, Poupança...)" value={editingAccount?.account_type || ''} onChange={e => setEditingAccount(p => ({ ...p, account_type: e.target.value }))} />
              <Input placeholder="CNPJ/CPF do Titular" value={editingAccount?.holder_document || ''} onChange={e => setEditingAccount(p => ({ ...p, holder_document: e.target.value }))} />
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Saldo Inicial</Label><Input type="number" placeholder="0.00" value={editingAccount?.initial_balance || ''} onChange={e => setEditingAccount(p => ({ ...p, initial_balance: e.target.value }))} disabled={!!editingAccount?.id} /></div>
                <div><Label>Data de Início</Label><Input type="date" value={editingAccount?.start_date || ''} onChange={e => setEditingAccount(p => ({ ...p, start_date: e.target.value }))} /></div>
              </div>
              <Textarea placeholder="Observações" value={editingAccount?.observations || ''} onChange={e => setEditingAccount(p => ({ ...p, observations: e.target.value }))} />
              <div>
                <Label>Acesso das Empresas</Label>
                <div className="mt-2 space-y-2 p-3 border rounded-md max-h-32 overflow-y-auto">
                  {allowedCompanies.map(company => (
                    <div key={company.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`company-${company.id}`}
                        checked={editingAccount?.accessible_companies?.includes(company.id)}
                        onCheckedChange={() => handleCompanyAccessChange(company.id)}
                      />
                      <Label htmlFor={`company-${company.id}`}>{company.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={handleSaveAccount}><Save className="mr-2" /> Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova {transactionData.type === 'inflow' ? 'Entrada' : 'Saída'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Descrição" onChange={e => setTransactionData(p => ({ ...p, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Valor</Label><Input type="number" placeholder="0.00" onChange={e => setTransactionData(p => ({ ...p, value: e.target.value }))} /></div>
                <div><Label>Data</Label><Input type="date" value={transactionData.transaction_date} onChange={e => setTransactionData(p => ({ ...p, transaction_date: e.target.value }))} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={handleSaveTransaction}><Save className="mr-2" /> Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Transferência Entre Contas</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><Label>De</Label><select className="w-full p-2 border rounded" value={transferData.from_account_id} onChange={e => setTransferData(p => ({ ...p, from_account_id: e.target.value }))}><option>Selecione</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} / {a.account_number}</option>)}</select></div>
              <div><Label>Para</Label><select className="w-full p-2 border rounded" onChange={e => setTransferData(p => ({ ...p, to_account_id: e.target.value }))}><option>Selecione</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} / {a.account_number}</option>)}</select></div>
              <Input placeholder="Descrição" onChange={e => setTransferData(p => ({ ...p, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Valor</Label><Input type="number" placeholder="0.00" onChange={e => setTransferData(p => ({ ...p, value: e.target.value }))} /></div>
                <div><Label>Data</Label><Input type="date" value={transferData.transaction_date} onChange={e => setTransferData(p => ({ ...p, transaction_date: e.target.value }))} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={handleSaveTransfer}><ArrowRightLeft className="mr-2" /> Transferir</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Isso excluirá permanentemente a conta <strong>{accountToDelete?.bank_name} ({accountToDelete?.account_number})</strong> e todas as suas transações.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
};

export default Bancos;