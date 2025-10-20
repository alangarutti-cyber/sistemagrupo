import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Edit, Trash2, Save, X, CreditCard, Building, RefreshCw } from 'lucide-react';
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
    
    const MaquinasCartao = ({ user, companies, userCompanyAccess }) => {
      const { toast } = useToast();
      const [machines, setMachines] = useState([]);
      const [operators, setOperators] = useState([]);
      const [loading, setLoading] = useState(true);
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
      const [editingMachine, setEditingMachine] = useState(null);
      const [machineToDelete, setMachineToDelete] = useState(null);
      const [currentMachineData, setCurrentMachineData] = useState({ company_id: '', serial_number: '', rental_value: '', machine_number: '', operator_id: '' });
    
      const allowedCompanies = user.is_admin 
        ? companies 
        : companies.filter(c => userCompanyAccess.some(ua => ua.user_id === user.id && ua.company_id === c.id));
    
      const fetchOperators = useCallback(async () => {
        const { data, error } = await supabase
          .from('card_operators')
          .select('id, name')
          .eq('status', 'active');
    
        if (error) {
          toast({ title: "Erro ao buscar operadoras", description: error.message, variant: "destructive" });
          setOperators([]);
        } else {
          setOperators(data || []);
        }
      }, [toast]);
    
      const fetchMachines = useCallback(async () => {
        setLoading(true);
        
        let query = supabase
          .from('card_machines')
          .select(`
            *,
            card_operators ( name ),
            companies ( name )
          `)
          .order('machine_number');
    
        if (!user.is_admin) {
          const companyIds = allowedCompanies.map(c => c.id);
          query = query.in('company_id', companyIds);
        }
    
        const { data, error } = await query;
    
        if (error) {
          toast({ title: "Erro ao buscar máquinas", description: error.message, variant: "destructive" });
        } else {
          setMachines(data);
        }
        setLoading(false);
      }, [toast, user.is_admin, allowedCompanies]);
    
      useEffect(() => {
        fetchMachines();
        fetchOperators();
      }, [fetchMachines, fetchOperators]);
    
      const handleSave = async () => {
        if (!currentMachineData.company_id || !currentMachineData.serial_number || !currentMachineData.machine_number) {
          toast({ title: "Campos obrigatórios", description: "Empresa, número de série e número da máquina são obrigatórios.", variant: "destructive" });
          return;
        }
    
        const dataToSave = {
          ...currentMachineData,
          rental_value: parseFloat(currentMachineData.rental_value) || null,
          machine_number: parseInt(currentMachineData.machine_number, 10),
          operator_id: currentMachineData.operator_id ? parseInt(currentMachineData.operator_id, 10) : null,
        };
    
        let error;
        if (editingMachine) {
          ({ error } = await supabase.from('card_machines').update(dataToSave).eq('id', editingMachine.id));
        } else {
          ({ error } = await supabase.from('card_machines').insert(dataToSave));
        }
    
        if (error) {
          toast({ title: "Erro ao salvar máquina", description: error.message, variant: "destructive" });
        } else {
          toast({ title: `Máquina ${editingMachine ? 'atualizada' : 'criada'}!`, variant: "success" });
          setIsDialogOpen(false);
          setEditingMachine(null);
          fetchMachines();
        }
      };
    
      const handleDelete = async () => {
        if (!machineToDelete) return;
        const { error } = await supabase.from('card_machines').delete().eq('id', machineToDelete.id);
        if (error) {
          toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Máquina excluída!", variant: "success" });
          fetchMachines();
        }
        setIsDeleteDialogOpen(false);
        setMachineToDelete(null);
      };
    
      const openDialog = (machine = null) => {
        setEditingMachine(machine);
        if (machine) {
          setCurrentMachineData({
            company_id: machine.company_id,
            serial_number: machine.serial_number,
            rental_value: machine.rental_value || '',
            machine_number: machine.machine_number || '',
            operator_id: machine.operator_id || '',
          });
        } else {
          setCurrentMachineData({ company_id: allowedCompanies.length === 1 ? allowedCompanies[0].id : '', serial_number: '', rental_value: '', machine_number: '', operator_id: '' });
        }
        setIsDialogOpen(true);
      };
    
      const openDeleteDialog = (machine) => {
        setMachineToDelete(machine);
        setIsDeleteDialogOpen(true);
      };
    
      const handleInputChange = (e) => {
        const { id, value } = e.target;
        setCurrentMachineData(prev => ({ ...prev, [id]: value }));
      };

      const handleSynchronize = () => {
        fetchMachines();
        toast({ title: "Sincronizando...", description: "Atualizando a lista de máquinas de cartão." });
      };
    
      return (
        <div className="space-y-6 p-4">
          <div className="flex justify-end gap-2">
            <Button onClick={handleSynchronize} className="bg-blue-500 hover:bg-blue-600 text-white">
              <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar
            </Button>
            <Button onClick={() => openDialog()} className="gradient-primary text-white">
              <Plus className="w-4 h-4 mr-2" /> Nova Máquina
            </Button>
          </div>
    
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingMachine ? 'Editar' : 'Nova'} Máquina de Cartão</DialogTitle>
                <DialogDescription>Preencha os dados da máquina.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="company_id">Empresa</Label>
                  <select id="company_id" value={currentMachineData.company_id} onChange={handleInputChange} className="w-full px-3 py-2 rounded-md border border-gray-300">
                    <option value="">Selecione uma empresa</option>
                    {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="machine_number">Número da Máquina</Label>
                    <Input id="machine_number" type="number" value={currentMachineData.machine_number} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serial_number">Número de Série</Label>
                    <Input id="serial_number" value={currentMachineData.serial_number} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="operator_id">Operadora</Label>
                    <select id="operator_id" value={currentMachineData.operator_id} onChange={handleInputChange} className="w-full px-3 py-2 rounded-md border border-gray-300">
                      <option value="">Nenhuma</option>
                      {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rental_value">Valor do Aluguel (R$)</Label>
                    <Input id="rental_value" type="number" value={currentMachineData.rental_value} onChange={handleInputChange} placeholder="Opcional" />
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
                  Tem certeza que deseja excluir a máquina "{machineToDelete?.machine_number}"?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
    
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? <p>Carregando...</p> : machines.map((machine, i) => (
              <motion.div
                key={machine.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-effect rounded-xl p-4 border-l-4 border-rose-500 relative"
              >
                <div className="absolute top-1 right-1 flex">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(machine)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => openDeleteDialog(machine)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-rose-100">
                    <CreditCard className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Máquina {machine.machine_number}</h3>
                    <p className="text-sm text-gray-600">{machine.card_operators?.name || 'Sem operadora'}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-2"><Building className="w-4 h-4 text-gray-500" /> {machine.companies?.name || 'Empresa não encontrada'}</p>
                  <p><span className="text-gray-500">Série:</span> {machine.serial_number}</p>
                  {machine.rental_value && <p><span className="text-gray-500">Aluguel:</span> R$ {machine.rental_value.toFixed(2)}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      );
    };
    
    export default MaquinasCartao;