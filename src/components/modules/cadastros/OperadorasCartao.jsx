import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
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

    const OperadorasCartaoTab = ({ companies }) => {
      const { toast } = useToast();
      const [operators, setOperators] = useState([]);
      const [loading, setLoading] = useState(true);
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
      const [editingOperator, setEditingOperator] = useState(null);
      const [operatorToDelete, setOperatorToDelete] = useState(null);
      const [currentOperatorData, setCurrentOperatorData] = useState({ name: '', days_to_receive: '', status: 'active', company_id: '' });

      const fetchOperators = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from('card_operators')
          .select('*, company:companies(name)')
          .order('name');

        if (error) {
          toast({ title: "Erro ao buscar operadoras", description: error.message, variant: "destructive" });
        } else {
          setOperators(data || []);
        }
        setLoading(false);
      }, [toast]);

      useEffect(() => {
        fetchOperators();
      }, [fetchOperators]);

      const handleSave = async () => {
        if (!currentOperatorData.name || !currentOperatorData.company_id) {
          toast({ title: "Campos obrigatórios", description: "Nome e empresa são obrigatórios.", variant: "destructive" });
          return;
        }

        const dataToSave = {
          name: currentOperatorData.name,
          days_to_receive: parseInt(currentOperatorData.days_to_receive, 10) || null,
          status: currentOperatorData.status,
          company_id: currentOperatorData.company_id,
        };

        let error;
        if (editingOperator) {
          const { error: updateError } = await supabase.from('card_operators').update(dataToSave).eq('id', editingOperator.id);
          error = updateError;
        } else {
          const { error: insertError } = await supabase.from('card_operators').insert(dataToSave);
          error = insertError;
        }

        if (error) {
          toast({ title: `Erro ao ${editingOperator ? 'atualizar' : 'criar'} operadora`, description: error.message, variant: "destructive" });
          return;
        }

        toast({ title: `Operadora ${editingOperator ? 'atualizada' : 'criada'}!`, variant: "success" });
        setIsDialogOpen(false);
        setEditingOperator(null);
        fetchOperators();
      };

      const handleDelete = async () => {
        if (!operatorToDelete) return;
        
        await supabase.from('card_operator_company_access').delete().eq('operator_id', operatorToDelete.id);

        const { error } = await supabase.from('card_operators').delete().eq('id', operatorToDelete.id);
        if (error) {
          toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Operadora excluída!", variant: "success" });
          fetchOperators();
        }
        setIsDeleteDialogOpen(false);
        setOperatorToDelete(null);
      };

      const openDialog = (operator = null) => {
        setEditingOperator(operator);
        if (operator) {
          setCurrentOperatorData({
            name: operator.name,
            days_to_receive: operator.days_to_receive || '',
            status: operator.status,
            company_id: operator.company_id || '',
          });
        } else {
          setCurrentOperatorData({ name: '', days_to_receive: '', status: 'active', company_id: companies.length > 0 ? companies[0].id : '' });
        }
        setIsDialogOpen(true);
      };

      const openDeleteDialog = (operator) => {
        setOperatorToDelete(operator);
        setIsDeleteDialogOpen(true);
      };

      const handleInputChange = (e) => {
        const { id, value } = e.target;
        setCurrentOperatorData(prev => ({ ...prev, [id]: value }));
      };

      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => openDialog()} className="gradient-primary text-white">
              <Plus className="w-4 h-4 mr-2" /> Nova Operadora
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingOperator ? 'Editar' : 'Nova'} Operadora de Cartão</DialogTitle>
                <DialogDescription>Preencha os dados da operadora.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Operadora</Label>
                  <Input id="name" value={currentOperatorData.name} onChange={handleInputChange} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="company_id">Empresa</Label>
                        <select id="company_id" value={currentOperatorData.company_id} onChange={handleInputChange} className="w-full px-3 py-2 rounded-md border border-input bg-background">
                            <option value="">Selecione...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="days_to_receive">Dias para Recebimento</Label>
                        <Input id="days_to_receive" type="number" value={currentOperatorData.days_to_receive} onChange={handleInputChange} placeholder="Ex: 30" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select id="status" value={currentOperatorData.status} onChange={handleInputChange} className="w-full px-3 py-2 rounded-md border border-input bg-background">
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
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
                  Tem certeza que deseja excluir a operadora "{operatorToDelete?.name}"? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="bg-card rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Recebimento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan="5" className="text-center p-6">Carregando...</td></tr>
                  ) : operators.length === 0 ? (
                    <tr><td colSpan="5" className="text-center p-6 text-muted-foreground">Nenhuma operadora cadastrada.</td></tr>
                  ) : (
                    operators.map(op => (
                      <tr key={op.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{op.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{op.company?.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{op.days_to_receive ? `${op.days_to_receive} dias` : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${op.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {op.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button variant="ghost" size="icon" onClick={() => openDialog(op)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(op)}><Trash2 className="h-4 w-4" /></Button>
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

    export default OperadorasCartaoTab;