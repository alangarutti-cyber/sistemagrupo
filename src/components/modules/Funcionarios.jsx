import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Bike, Download, Save, Edit, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useUser } from '@/contexts/UserContext';

const Funcionarios = ({ isDialogMode = false, onEmployeeCreated, initialCompanyId, initialEmployeeName }) => {
  const { user, companies, onDataUpdate } = useUser();
  const { toast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(!isDialogMode);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [currentEmployeeData, setCurrentEmployeeData] = useState({ company_id: '', name: '', pix_key: '', role: 'Motoboy', valor_encosta: '', valor_entrega: '', salario: '', encargos: '', inss_empresa: '', fgts: '', ferias_terco: '', decimo_terceiro: '', gratificacao: '', cargo: '', setor: '', valor_hora: '', valor_fixo: '' });
  const [paymentData, setPaymentData] = useState([]);
  const [paymentPeriod, setPaymentPeriod] = useState({ start: '', end: '' });
  const [companySectors, setCompanySectors] = useState([]);

  const allowedCompanies = companies; // Removed filter

  const roles = ['Todos', 'Motoboy', 'Freelancer', 'CLT'];

  useEffect(() => {
    if (isDialogMode) {
      setSelectedCompany(initialCompanyId);
      setCurrentEmployeeData(prev => ({ ...prev, name: initialEmployeeName || '', company_id: initialCompanyId }));
    } else if (allowedCompanies.length > 0 && !selectedCompany) {
      setSelectedCompany(allowedCompanies[0].id);
    }
  }, [allowedCompanies, selectedCompany, isDialogMode, initialCompanyId, initialEmployeeName]);

  useEffect(() => {
    const companyId = currentEmployeeData.company_id || selectedCompany;
    if (companyId) {
      const company = companies.find(c => c.id === parseInt(companyId));
      setCompanySectors(company?.sectors || []);
    }
  }, [currentEmployeeData.company_id, selectedCompany, companies]);

  const fetchEmployees = useCallback(async () => {
    if (!selectedCompany || isDialogMode) return;
    setLoading(true);
    const { data, error } = await supabase.from('employees').select('*').eq('company_id', selectedCompany).order('name');
    if (error) toast({ title: "Erro ao buscar funcionários", description: error.message, variant: "destructive" });
    else setEmployees(data);
    setLoading(false);
  }, [selectedCompany, toast, isDialogMode]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleSaveEmployee = async () => {
    if (!currentEmployeeData.company_id) {
      toast({ title: "Campo obrigatório", description: "Por favor, selecione uma empresa.", variant: "destructive" });
      return;
    }
    const dataToSave = {
      company_id: currentEmployeeData.company_id,
      name: currentEmployeeData.name,
      pix_key: currentEmployeeData.pix_key,
      role: currentEmployeeData.role,
      valor_encosta: currentEmployeeData.role === 'Motoboy' ? parseFloat(currentEmployeeData.valor_encosta) || 0 : null,
      valor_entrega: currentEmployeeData.role === 'Motoboy' ? parseFloat(currentEmployeeData.valor_entrega) || 0 : null,
      salario: ['Freelancer', 'CLT'].includes(currentEmployeeData.role) ? parseFloat(currentEmployeeData.salario) || 0 : null,
      encargos: currentEmployeeData.role === 'CLT' ? parseFloat(currentEmployeeData.encargos) || 0 : null,
      inss_empresa: currentEmployeeData.role === 'CLT' ? parseFloat(currentEmployeeData.inss_empresa) || 0 : null,
      fgts: currentEmployeeData.role === 'CLT' ? parseFloat(currentEmployeeData.fgts) || 0 : null,
      ferias_terco: currentEmployeeData.role === 'CLT' ? parseFloat(currentEmployeeData.ferias_terco) || 0 : null,
      decimo_terceiro: currentEmployeeData.role === 'CLT' ? parseFloat(currentEmployeeData.decimo_terceiro) || 0 : null,
      gratificacao: currentEmployeeData.role === 'CLT' ? parseFloat(currentEmployeeData.gratificacao) || 0 : null,
      cargo: currentEmployeeData.role === 'CLT' ? currentEmployeeData.cargo : null,
      setor: ['Freelancer', 'CLT'].includes(currentEmployeeData.role) ? currentEmployeeData.setor : null,
      valor_hora: currentEmployeeData.role === 'Freelancer' ? parseFloat(currentEmployeeData.valor_hora) || 0 : null,
      valor_fixo: currentEmployeeData.role === 'Freelancer' ? parseFloat(currentEmployeeData.valor_fixo) || 0 : null,
    };

    let error;
    let newEmployee = null;
    if (editingEmployee) {
      ({ error } = await supabase.from('employees').update(dataToSave).eq('id', editingEmployee.id).select().single());
    } else {
        const { data, error: insertError } = await supabase.from('employees').insert(dataToSave).select().single();
        error = insertError;
        newEmployee = data;
    }
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else { 
      toast({ title: `Funcionário ${editingEmployee ? 'atualizado' : 'criado'}!`, variant: "success" }); 
      if (isDialogMode) {
        onEmployeeCreated(newEmployee || editingEmployee);
      } else {
        setIsDialogOpen(false); 
        fetchEmployees(); 
      }
    }
  };

  const handleDeleteEmployee = async () => {
    const { error } = await supabase.from('employees').delete().eq('id', employeeToDelete.id);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else { toast({ title: "Funcionário excluído!", variant: "success" }); fetchEmployees(); }
    setIsDeleteOpen(false);
  };

  const openDialog = (employee = null) => {
    setEditingEmployee(employee);
    setCurrentEmployeeData(employee ? { ...employee } : { company_id: selectedCompany, name: '', pix_key: '', role: 'Motoboy', valor_encosta: '', valor_entrega: '', salario: '', encargos: '', inss_empresa: '', fgts: '', ferias_terco: '', decimo_terceiro: '', gratificacao: '', cargo: '', setor: '', valor_hora: '', valor_fixo: '' });
    setIsDialogOpen(true);
  };

  const openPaymentDialog = async () => {
    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - today.getDay());
    const previousSaturday = new Date(lastSunday);
    previousSaturday.setDate(lastSunday.getDate() - 6);

    const startDate = previousSaturday.toISOString().split('T')[0];
    const endDate = lastSunday.toISOString().split('T')[0];

    setPaymentPeriod({ start: startDate, end: endDate });

    const { data: dailyEntries, error } = await supabase
      .from('daily_entries')
      .select('employee_id, units, hora_entrada, hora_saida, desconto')
      .eq('company_id', selectedCompany)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (error) {
      toast({ title: "Erro ao buscar lançamentos diários", description: error.message, variant: "destructive" });
      return;
    }

    const entriesByEmployee = dailyEntries.reduce((acc, entry) => {
      if (!acc[entry.employee_id]) {
        acc[entry.employee_id] = { units: 0, hoursWorked: 0, totalDiscount: 0 };
      }
      if (entry.units !== null) {
        acc[entry.employee_id].units += entry.units;
      }
      if (entry.hora_entrada && entry.hora_saida) {
        const [startH, startM] = entry.hora_entrada.split(':').map(Number);
        const [endH, endM] = entry.hora_saida.split(':').map(Number);
        const startDate = new Date(0, 0, 0, startH, startM, 0);
        const endDate = new Date(0, 0, 0, endH, endM, 0);
        let diff = endDate.getTime() - startDate.getTime();
        if (diff < 0) { // overnight
            diff += 24 * 60 * 60 * 1000;
        }
        acc[entry.employee_id].hoursWorked += diff / (1000 * 60 * 60);
      }
      acc[entry.employee_id].totalDiscount += entry.desconto || 0;
      return acc;
    }, {});

    setPaymentData(employees.filter(e => e.role !== 'CLT').map(e => {
      const employeeEntries = entriesByEmployee[e.id] || { units: 0, hoursWorked: 0, totalDiscount: 0 };
      return {
        id: e.id, name: e.name, role: e.role, setor: e.setor,
        valor_encosta: e.valor_encosta, valor_entrega: e.valor_entrega, valor_hora: e.valor_hora, valor_fixo: e.valor_fixo,
        units: employeeEntries.units,
        hoursWorked: employeeEntries.hoursWorked,
        discount: employeeEntries.totalDiscount
      };
    }));
    setIsPaymentOpen(true);
  };

  const handleSendToConference = async () => {
    const paymentsToInsert = paymentData.filter(p => p.units > 0 || p.hoursWorked > 0 || p.valor_fixo > 0).map(p => {
      let total = 0;
      if (p.role === 'Motoboy') {
        total = (p.valor_encosta || 0) + (p.units * (p.valor_entrega || 0));
      } else if (p.role === 'Freelancer') {
        total = (p.valor_fixo || 0) + (p.hoursWorked * (p.valor_hora || 0));
      }
      total -= (p.discount || 0);

      const paymentDetails = [{
        name: p.name,
        role: p.role,
        setor: p.setor,
        deliveries: p.role === 'Motoboy' ? p.units : 0,
        hours: p.role === 'Freelancer' ? p.hoursWorked.toFixed(2) : 0,
        fixed_value: p.role === 'Freelancer' ? p.valor_fixo : 0,
        discount: p.discount || 0,
        total: total
      }];

      return {
        company_id: selectedCompany,
        user_id: user.id,
        start_date: paymentPeriod.start,
        end_date: paymentPeriod.end,
        total_value: total,
        payment_details: paymentDetails,
        status: 'Pendente',
        descontos: p.discount || 0,
        employee_id: p.id
      };
    });

    if (paymentsToInsert.length === 0) {
      toast({ title: "Nenhum pagamento a fazer", description: "Nenhum funcionário teve lançamentos ou valor fixo para o período.", variant: "warning" });
      return;
    }

    const { error } = await supabase.from('employee_payments').insert(paymentsToInsert);
    if (error) toast({ title: "Erro ao enviar para conferência", description: error.message, variant: "destructive" });
    else { toast({ title: "Pagamentos enviados para conferência!", description: "Acesse o módulo de Conferência para aprovar.", variant: "success" }); setIsPaymentOpen(false); }
  };

  const renderEmployeeFields = () => {
    switch (currentEmployeeData.role) {
      case 'Motoboy':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Valor Diária/Encosta (R$)</Label><Input type="number" value={currentEmployeeData.valor_encosta || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, valor_encosta: e.target.value }))} /></div>
            <div><Label>Valor por Entrega (R$)</Label><Input type="number" value={currentEmployeeData.valor_entrega || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, valor_entrega: e.target.value }))} /></div>
          </div>
        );
      case 'Freelancer':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor por Hora (R$)</Label><Input type="number" value={currentEmployeeData.valor_hora || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, valor_hora: e.target.value }))} /></div>
              <div><Label>Valor Fixo (R$)</Label><Input type="number" value={currentEmployeeData.valor_fixo || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, valor_fixo: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Setor</Label>
              <select value={currentEmployeeData.setor || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, setor: e.target.value }))} className="w-full mt-1 p-2 border rounded-md bg-background focus:ring-primary focus:border-primary">
                <option value="" disabled>Selecione um setor</option>
                {companySectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>
          </div>
        );
      case 'CLT':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cargo</Label>
                <Input value={currentEmployeeData.cargo || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, cargo: e.target.value }))} />
              </div>
              <div>
                <Label>Setor</Label>
                <select value={currentEmployeeData.setor || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, setor: e.target.value }))} className="w-full mt-1 p-2 border rounded-md bg-background focus:ring-primary focus:border-primary">
                  <option value="" disabled>Selecione um setor</option>
                  {companySectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
                </select>
              </div>
            </div>
            <div><Label>Salário Base (R$)</Label><Input type="number" value={currentEmployeeData.salario || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, salario: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>INSS Empresa (%)</Label><Input type="number" value={currentEmployeeData.inss_empresa || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, inss_empresa: e.target.value }))} /></div>
              <div><Label>FGTS (%)</Label><Input type="number" value={currentEmployeeData.fgts || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, fgts: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Férias + 1/3 (%)</Label><Input type="number" value={currentEmployeeData.ferias_terco || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, ferias_terco: e.target.value }))} /></div>
              <div><Label>13º Salário (%)</Label><Input type="number" value={currentEmployeeData.decimo_terceiro || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, decimo_terceiro: e.target.value }))} /></div>
            </div>
            <div><Label>Gratificação (R$)</Label><Input type="number" value={currentEmployeeData.gratificacao || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, gratificacao: e.target.value }))} /></div>
          </div>
        );
      default:
        return null;
    }
  };

  const calculateCltCost = (emp) => {
    const base = emp.salario || 0;
    const inss = base * ((emp.inss_empresa || 0) / 100);
    const fgts = base * ((emp.fgts || 0) / 100);
    const ferias = base * ((emp.ferias_terco || 0) / 100);
    const decimo = base * ((emp.decimo_terceiro || 0) / 100);
    const gratificacao = emp.gratificacao || 0;
    return base + inss + fgts + ferias + decimo + gratificacao;
  };

  const getEmployeeIcon = (role) => {
    switch (role) {
      case 'Motoboy': return <Bike className="w-5 h-5 text-pink-500" />;
      case 'Freelancer': return <Users className="w-5 h-5 text-purple-500" />;
      case 'CLT': return <UserCheck className="w-5 h-5 text-sky-500" />;
      default: return <Users className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isDialogMode) {
    return (
      <div className="space-y-4 py-4">
        <div>
          <Label>Empresa</Label>
          <select value={currentEmployeeData.company_id} onChange={e => setCurrentEmployeeData(p => ({ ...p, company_id: e.target.value }))} className="w-full mt-1 p-2 border rounded-md bg-background focus:ring-primary focus:border-primary">
            <option value="" disabled>Selecione a empresa</option>
            {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Nome</Label><Input value={currentEmployeeData.name} onChange={e => setCurrentEmployeeData(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Chave PIX</Label><Input value={currentEmployeeData.pix_key || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, pix_key: e.target.value }))} /></div>
        </div>
        <div>
          <Label>Função</Label>
          <select value={currentEmployeeData.role} onChange={e => setCurrentEmployeeData(p => ({ ...p, role: e.target.value }))} className="w-full mt-1 p-2 border rounded-md bg-background focus:ring-primary focus:border-primary">
            <option>Motoboy</option>
            <option>Freelancer</option>
            <option>CLT</option>
          </select>
        </div>
        {renderEmployeeFields()}
        <div className="pt-4 flex justify-end">
          <Button onClick={handleSaveEmployee}><Save className="w-4 h-4 mr-2" /> Salvar Funcionário</Button>
        </div>
      </div>
    );
  }

  const filteredEmployees = employees.filter(emp => roleFilter === 'Todos' || emp.role === roleFilter);

  return (
    <div className="space-y-6">
      <div className="bg-card p-4 rounded-xl shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Label htmlFor="company-select-func">Empresa</Label>
            <select id="company-select-func" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-background focus:ring-primary focus:border-primary md:w-auto">
              {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openDialog()} className="flex-1"><Plus className="w-4 h-4 mr-2" /> Novo Colaborador</Button>
            <Button onClick={openPaymentDialog} variant="outline" className="flex-1"><Download className="w-4 h-4 mr-2" /> Fechar Semana</Button>
          </div>
        </div>
        <div>
          <Label>Filtrar por Função</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {roles.map(role => (
              <Button
                key={role}
                variant={roleFilter === role ? 'destructive' : 'outline'}
                onClick={() => setRoleFilter(role)}
                className="text-sm px-3 py-1 h-auto"
              >
                {role}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card p-4 rounded-xl shadow-md">
        <div className="space-y-2">
          {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : filteredEmployees.map((emp, i) => (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-4 flex-1 mb-4 sm:mb-0">
                {getEmployeeIcon(emp.role)}
                <div className="flex-1">
                  <h3 className="font-semibold text-card-foreground">{emp.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {emp.role}
                    {emp.role === 'CLT' && emp.cargo && ` (${emp.cargo})`}
                    {emp.role === 'Freelancer' && emp.setor && ` (${emp.setor})`}
                  </p>
                </div>
              </div>
              <div className="flex-1 text-sm text-muted-foreground mb-4 sm:mb-0">
                <p><span className="font-medium">PIX:</span> {emp.pix_key || 'N/A'}</p>
                {emp.role === 'Motoboy' && <p><span className="font-medium">Valores:</span> R${(emp.valor_encosta || 0).toFixed(2)} (diária) + R${(emp.valor_entrega || 0).toFixed(2)} (entrega)</p>}
                {emp.role === 'Freelancer' && (
                  <>
                    {emp.valor_hora > 0 && <p><span className="font-medium">Valor/Hora:</span> R${(emp.valor_hora || 0).toFixed(2)}</p>}
                    {emp.valor_fixo > 0 && <p><span className="font-medium">Valor Fixo:</span> R${(emp.valor_fixo || 0).toFixed(2)}</p>}
                  </>
                )}
                {emp.role === 'CLT' && <p><span className="font-medium">Custo Total:</span> R${calculateCltCost(emp).toFixed(2)}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => openDialog(emp)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-500" onClick={() => { setEmployeeToDelete(emp); setIsDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </motion.div>
          ))}
          {!loading && filteredEmployees.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum funcionário encontrado para esta seleção.</p>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEmployee ? 'Editar' : 'Novo'} Colaborador</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
            <div>
              <Label>Empresa</Label>
              <select value={currentEmployeeData.company_id} onChange={e => setCurrentEmployeeData(p => ({ ...p, company_id: e.target.value }))} className="w-full mt-1 p-2 border rounded-md bg-background focus:ring-primary focus:border-primary">
                <option value="" disabled>Selecione a empresa</option>
                {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome</Label><Input value={currentEmployeeData.name} onChange={e => setCurrentEmployeeData(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Chave PIX</Label><Input value={currentEmployeeData.pix_key || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, pix_key: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Função</Label>
              <select value={currentEmployeeData.role} onChange={e => setCurrentEmployeeData(p => ({ ...p, role: e.target.value }))} className="w-full mt-1 p-2 border rounded-md bg-background focus:ring-primary focus:border-primary">
                <option>Motoboy</option>
                <option>Freelancer</option>
                <option>CLT</option>
              </select>
            </div>
            {renderEmployeeFields()}
          </div>
          <DialogFooter><Button onClick={handleSaveEmployee}><Save className="w-4 h-4 mr-2" /> Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Deseja excluir "{employeeToDelete?.name}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteEmployee}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Fechar Pagamentos da Semana</DialogTitle>
            <DialogDescription>Confira os valores calculados a partir dos lançamentos diários e adicione descontos se necessário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Início</Label><Input type="date" value={paymentPeriod.start} readOnly /></div>
              <div><Label>Data Fim</Label><Input type="date" value={paymentPeriod.end} readOnly /></div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 p-2 border rounded-lg">
              {paymentData.map((emp, index) => (
                <div key={emp.id} className="grid grid-cols-12 items-center gap-2 p-2 rounded-md hover:bg-muted">
                  <Label className="col-span-4">{emp.name}</Label>
                  <div className="col-span-2 text-center text-sm">
                    {emp.role === 'Motoboy' && `${emp.units} entregas`}
                    {emp.role === 'Freelancer' && emp.hoursWorked > 0 && `${emp.hoursWorked.toFixed(2)} horas`}
                    {emp.role === 'Freelancer' && emp.valor_fixo > 0 && `Fixo`}
                  </div>
                  <div className="col-span-3">
                    <Input type="number" placeholder="Desconto (R$)" value={emp.discount} onChange={e => {
                      const newPaymentData = [...paymentData];
                      newPaymentData[index].discount = parseFloat(e.target.value) || 0;
                      setPaymentData(newPaymentData);
                    }} />
                  </div>
                  <div className="font-semibold text-right col-span-3">
                    R$ {
                      ((emp.role === 'Motoboy' ? (emp.valor_encosta || 0) + (emp.units * (emp.valor_entrega || 0)) : (emp.valor_fixo || 0) + (emp.hoursWorked * (emp.valor_hora || 0))) - (emp.discount || 0)).toFixed(2)
                    }
                  </div>
                </div>
              ))}
            </div>
            <div className="text-right font-bold text-lg pt-2 border-t">Total: R$ {paymentData.reduce((acc, p) => {
              const total = (p.role === 'Motoboy' ? (p.valor_encosta || 0) + (p.units * (p.valor_entrega || 0)) : (p.valor_fixo || 0) + (p.hoursWorked * (p.valor_hora || 0)));
              return acc + total - (p.discount || 0);
            }, 0).toFixed(2)}</div>
          </div>
          <DialogFooter><Button onClick={handleSendToConference}><Save className="w-4 h-4 mr-2" /> Enviar para Conferência</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Funcionarios;