
import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Edit, Trash2, Save, X, Check, ChevronsUpDown } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import {
      Dialog,
      DialogContent,
      DialogDescription,
      DialogFooter,
      DialogHeader,
      DialogTitle,
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
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
    import { cn } from "@/lib/utils";

    const FormasPagamentoTab = ({ companies, user }) => {
      const { toast } = useToast();
      const [paymentMethods, setPaymentMethods] = useState([]);
      const [operators, setOperators] = useState([]);
      const [bankAccounts, setBankAccounts] = useState([]);
      const [loading, setLoading] = useState(true);
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
      const [editingMethod, setEditingMethod] = useState(null);
      const [methodToDelete, setMethodToDelete] = useState(null);
      const [currentMethodData, setCurrentMethodData] = useState({ name: '', fee: '', taxa_adicional: '', operator_id: '', meio: 'fisico', prazo_dias: '0', tipo_recebimento: 'À Vista', conta_id: '' });
      const [selectedCompanies, setSelectedCompanies] = useState([]);
      const [isCompanyPopoverOpen, setIsCompanyPopoverOpen] = useState(false);

      const fetchInitialData = useCallback(async () => {
        setLoading(true);
        
        const { data: methodsData, error: methodsError } = await supabase
          .from('payment_methods')
          .select('*, operator:card_operators(name), companies:payment_method_company_access(company:companies(id, name)), account:bank_accounts(bank_name)')
          .order('name');

        if (methodsError) {
          toast({ title: "Erro ao buscar formas de pagamento", description: methodsError.message, variant: "destructive" });
        } else {
          const formattedMethods = methodsData.map(method => ({
            ...method,
            companies: method.companies.map(c => c.company)
          }));
          setPaymentMethods(formattedMethods || []);
        }

        const { data: operatorsData, error: operatorsError } = await supabase
          .from('card_operators')
          .select('*')
          .eq('status', 'active');
        if (operatorsError) {
          toast({ title: "Erro ao buscar operadoras", description: operatorsError.message, variant: "destructive" });
        } else {
          setOperators(operatorsData || []);
        }
        
        const { data: accountsData, error: accountsError } = await supabase
          .from('bank_accounts')
          .select('id, bank_name, account_number');
        if (accountsError) {
            toast({ title: "Erro ao buscar contas bancárias", description: accountsError.message, variant: "destructive" });
        } else {
            setBankAccounts(accountsData || []);
        }

        setLoading(false);
      }, [toast]);

      useEffect(() => {
        fetchInitialData();
      }, [fetchInitialData]);

      const handleSave = async () => {
        if (!currentMethodData.name) {
          toast({ title: "Campos obrigatórios", description: "Preencha o nome.", variant: "destructive" });
          return;
        }

        const dataToSave = {
          name: currentMethodData.name,
          fee: parseFloat(currentMethodData.fee) || 0,
          taxa_adicional: parseFloat(currentMethodData.taxa_adicional) || 0,
          operator_id: currentMethodData.operator_id || null,
          meio: currentMethodData.meio,
          prazo_dias: parseInt(currentMethodData.prazo_dias, 10) || 0,
          tipo_recebimento: currentMethodData.tipo_recebimento,
          conta_id: currentMethodData.conta_id || null,
          dias_para_recebimento: parseInt(currentMethodData.prazo_dias, 10) || 0, // Sync with prazo_dias
        };

        let savedMethod;
        let error;

        if (editingMethod) {
          const { data, error: updateError } = await supabase.from('payment_methods').update(dataToSave).eq('id', editingMethod.id).select().single();
          error = updateError;
          savedMethod = data;
        } else {
          // This part is tricky as a new payment method needs a company_id
          // For simplicity, let's assume it picks the first selected company or a default.
          // The table schema has company_id as NOT NULL.
          if (selectedCompanies.length === 0) {
              toast({ title: "Empresa obrigatória", description: "Selecione ao menos uma empresa para criar uma forma de pagamento.", variant: "destructive"});
              return;
          }
          dataToSave.company_id = selectedCompanies[0];
          const { data, error: insertError } = await supabase.from('payment_methods').insert(dataToSave).select().single();
          error = insertError;
          savedMethod = data;
        }

        if (error || !savedMethod) {
          toast({ title: "Erro ao salvar forma de pagamento", description: error?.message || "Não foi possível obter o ID salvo.", variant: "destructive" });
          return;
        }

        const { error: deleteAccessError } = await supabase.from('payment_method_company_access').delete().eq('payment_method_id', savedMethod.id);
        if (deleteAccessError) {
          toast({ title: "Erro ao atualizar acesso das empresas", description: deleteAccessError.message, variant: "destructive" });
        }

        const companyAccessData = selectedCompanies.map(companyId => ({
          payment_method_id: savedMethod.id,
          company_id: companyId,
        }));

        if (companyAccessData.length > 0) {
            const { error: insertAccessError } = await supabase.from('payment_method_company_access').insert(companyAccessData);
            if (insertAccessError) {
              toast({ title: "Erro ao salvar acesso das empresas", description: insertAccessError.message, variant: "destructive" });
              return;
            }
        }

        toast({ title: `Forma de pagamento ${editingMethod ? 'atualizada' : 'criada'}!`, variant: "success" });
        setIsDialogOpen(false);
        setEditingMethod(null);
        fetchInitialData();
      };

      const handleDelete = async () => {
        if (!methodToDelete) return;
        
        await supabase.from('payment_method_company_access').delete().eq('payment_method_id', methodToDelete.id);
        
        const { error } = await supabase.from('payment_methods').delete().eq('id', methodToDelete.id);
        if (error) {
          toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Forma de pagamento excluída!", variant: "success" });
          fetchInitialData();
        }
        setIsDeleteDialogOpen(false);
        setMethodToDelete(null);
      };

      const openDialog = (method = null) => {
        setEditingMethod(method);
        if (method) {
          setCurrentMethodData({
            name: method.name,
            fee: method.fee,
            taxa_adicional: method.taxa_adicional || '',
            operator_id: method.operator_id || '',
            meio: method.meio || 'fisico',
            prazo_dias: method.prazo_dias || '0',
            tipo_recebimento: method.tipo_recebimento || 'À Vista',
            conta_id: method.conta_id || ''
          });
          setSelectedCompanies(method.companies.map(c => c.id));
        } else {
          setCurrentMethodData({ name: '', fee: '', taxa_adicional: '', operator_id: '', meio: 'fisico', prazo_dias: '0', tipo_recebimento: 'À Vista', conta_id: '' });
          setSelectedCompanies([]);
        }
        setIsDialogOpen(true);
      };

      const openDeleteDialog = (method) => {
        setMethodToDelete(method);
        setIsDeleteDialogOpen(true);
      };

      const handleInputChange = (e) => {
        const { id, value } = e.target;
        setCurrentMethodData(prev => ({ ...prev, [id]: value }));
      };

      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold">Gerenciar Formas de Pagamento</h2>
            <Button onClick={() => openDialog()} className="gradient-primary text-white">
              <Plus className="w-4 h-4 mr-2" /> Nova Forma de Pagamento
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingMethod ? 'Editar' : 'Nova'} Forma de Pagamento</DialogTitle>
                <DialogDescription>Preencha os dados da forma de pagamento.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={currentMethodData.name} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label>Empresas</Label>
                  <Popover open={isCompanyPopoverOpen} onOpenChange={setIsCompanyPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isCompanyPopoverOpen}
                        className="w-full justify-between"
                      >
                        {selectedCompanies.length > 0
                          ? `${selectedCompanies.length} empresa(s) selecionada(s)`
                          : "Selecione as empresas..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar empresa..." />
                        <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                        <CommandGroup>
                          {companies.map((company) => (
                            <CommandItem
                              key={company.id}
                              onSelect={() => {
                                const newSelection = selectedCompanies.includes(company.id)
                                  ? selectedCompanies.filter(id => id !== company.id)
                                  : [...selectedCompanies, company.id];
                                setSelectedCompanies(newSelection);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCompanies.includes(company.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {company.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="operator_id">Operadora de Cartão (Opcional)</Label>
                        <select id="operator_id" value={currentMethodData.operator_id} onChange={handleInputChange} className="w-full px-3 py-2 rounded-md border border-input bg-background">
                            <option value="">Nenhuma / Outro</option>
                            {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="meio">Meio de Pagamento</Label>
                        <select id="meio" value={currentMethodData.meio} onChange={handleInputChange} className="w-full px-3 py-2 rounded-md border border-input bg-background">
                            <option value="fisico">Físico (Maquininha)</option>
                            <option value="online">Online (Gateway)</option>
                            <option value="credito">Crédito</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="tipo_recebimento">Tipo de Recebimento</Label>
                        <select id="tipo_recebimento" value={currentMethodData.tipo_recebimento} onChange={handleInputChange} className="w-full px-3 py-2 rounded-md border border-input bg-background">
                            <option value="À Vista">À Vista</option>
                            <option value="Parcelado">Parcelado</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="conta_id">Conta de Destino</Label>
                      <select id="conta_id" value={currentMethodData.conta_id} onChange={handleInputChange} className="w-full px-3 py-2 rounded-md border border-input bg-background">
                        <option value="">Nenhuma</option>
                        {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bank_name} - {acc.account_number}</option>)}
                      </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fee">Taxa (%)</Label>
                    <Input id="fee" type="number" value={currentMethodData.fee} onChange={handleInputChange} placeholder="Ex: 2.5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxa_adicional">Taxa Adicional (R$)</Label>
                    <Input id="taxa_adicional" type="number" value={currentMethodData.taxa_adicional} onChange={handleInputChange} placeholder="Ex: 0.50" />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="prazo_dias">Prazo Receb. (dias)</Label>
                    <Input id="prazo_dias" type="number" value={currentMethodData.prazo_dias} onChange={handleInputChange} placeholder="Ex: 1" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}><X className="w-4 h-4 mr-2" /> Cancelar</Button>
                <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir la forma de pagamento "{methodToDelete?.name}"? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="glass-effect rounded-xl overflow-hidden max-h-[70vh] overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conta Destino</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxa (%)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prazo (dias)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center p-6">Carregando...</td></tr>
                  ) : paymentMethods.length === 0 ? (
                    <tr><td colSpan="6" className="text-center p-6 text-gray-500">Nenhuma forma de pagamento cadastrada.</td></tr>
                  ) : (
                    paymentMethods.map(method => (
                      <tr key={method.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{method.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-wrap gap-1">
                            {method.companies?.map(c => (
                              <span key={c.id} className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded-full">{c.name}</span>
                            )) || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{method.account?.bank_name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parseFloat(method.fee).toFixed(2)}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{method.prazo_dias || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button variant="ghost" size="icon" onClick={() => openDialog(method)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(method)}><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      );
    };

    export default FormasPagamentoTab;
