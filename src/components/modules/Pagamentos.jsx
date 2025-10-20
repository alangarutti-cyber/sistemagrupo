import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Bike, Download, Save, Edit, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Pagamentos = ({ user, companies }) => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [currentEmployeeData, setCurrentEmployeeData] = useState({ name: '', pix_key: '', role: 'Motoboy', valor_encosta: '', valor_entrega: '', salario: '', encargos: '', inss_empresa: '', fgts: '', ferias_terco: '', decimo_terceiro: '', gratificacao: '', cargo: '', setor: '' });
  const [paymentData, setPaymentData] = useState([]);
  const [paymentPeriod, setPaymentPeriod] = useState({ start: '', end: '' });
  const [companySectors, setCompanySectors] = useState([]);

  const allowedCompanies = user.is_admin ? companies : companies.filter(c => user.permissions?.companies?.includes(c.id));

  useEffect(() => {
    if (allowedCompanies.length > 0 && !selectedCompany) {
      setSelectedCompany(allowedCompanies[0].id);
    }
  }, [allowedCompanies, selectedCompany]);

  useEffect(() => {
    if (selectedCompany) {
      const company = companies.find(c => c.id === parseInt(selectedCompany));
      setCompanySectors(company?.sectors || []);
    }
  }, [selectedCompany, companies]);

  const fetchEmployees = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data, error } = await supabase.from('employees').select('*').eq('company_id', selectedCompany).order('name');
    if (error) toast({ title: "Erro ao buscar funcionários", description: error.message, variant: "destructive" });
    else setEmployees(data);
    setLoading(false);
  }, [selectedCompany, toast]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleSaveEmployee = async () => {
    const dataToSave = {
      company_id: selectedCompany,
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
      setor: currentEmployeeData.role === 'Freelancer' ? currentEmployeeData.setor : null,
    };

    let error;
    if (editingEmployee) {
      ({ error } = await supabase.from('employees').update(dataToSave).eq('id', editingEmployee.id));
    } else {
      ({ error } = await supabase.from('employees').insert(dataToSave));
    }
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else { toast({ title: `Funcionário ${editingEmployee ? 'atualizado' : 'criado'}!`, variant: "success" }); setIsDialogOpen(false); fetchEmployees(); }
  };

  const handleDeleteEmployee = async () => {
    const { error } = await supabase.from('employees').delete().eq('id', employeeToDelete.id);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else { toast({ title: "Funcionário excluído!", variant: "success" }); fetchEmployees(); }
    setIsDeleteOpen(false);
  };

  const openDialog = (employee = null) => {
    setEditingEmployee(employee);
    setCurrentEmployeeData(employee ? { ...employee } : { name: '', pix_key: '', role: 'Motoboy', valor_encosta: '', valor_entrega: '', salario: '', encargos: '', inss_empresa: '', fgts: '', ferias_terco: '', decimo_terceiro: '', gratificacao: '', cargo: '', setor: '' });
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
      .select('employee_id, units')
      .eq('company_id', selectedCompany)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (error) {
      toast({ title: "Erro ao buscar lançamentos diários", description: error.message, variant: "destructive" });
      return;
    }

    const unitsByEmployee = dailyEntries.reduce((acc, entry) => {
      acc[entry.employee_id] = (acc[entry.employee_id] || 0) + entry.units;
      return acc;
    }, {});

    setPaymentData(employees.filter(e => e.role !== 'CLT').map(e => ({
      id: e.id, name: e.name, role: e.role, setor: e.setor,
      valor_encosta: e.valor_encosta, valor_entrega: e.valor_entrega, salario: e.salario,
      units: unitsByEmployee[e.id] || 0,
      discount: 0
    })));
    setIsPaymentOpen(true);
  };

  const handleSendToConference = async () => {
    const paymentDetails = paymentData.filter(p => p.units > 0 || (p.role === 'Motoboy' && p.valor_encosta > 0)).map(p => {
      let total = 0;
      if (p.role === 'Motoboy') {
        total = (p.valor_encosta || 0) + (p.units * (p.valor_entrega || 0));
      } else if (p.role === 'Freelancer') {
        total = p.units * (p.salario || 0);
      }
      total -= (p.discount || 0);

      return {
        employee_id: p.id, name: p.name, role: p.role, setor: p.setor,
        deliveries: p.role === 'Motoboy' ? p.units : 0,
        hours: p.role === 'Freelancer' ? p.units : 0,
        discount: p.discount || 0,
        total: total
      };
    });

    if (paymentDetails.length === 0) {
      toast({ title: "Nenhum pagamento a fazer", description: "Nenhum funcionário teve entregas ou horas lançadas.", variant: "warning" });
      return;
    }
    const totalValue = paymentDetails.reduce((acc, curr) => acc + curr.total, 0);
    const totalDiscounts = paymentDetails.reduce((acc, curr) => acc + curr.discount, 0);

    const { error } = await supabase.from('employee_payments').insert({
      company_id: selectedCompany, user_id: user.id, start_date: paymentPeriod.start, end_date: paymentPeriod.end, total_value: totalValue, payment_details: paymentDetails, status: 'Pendente', descontos: totalDiscounts
    });
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
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Valor por Hora (R$)</Label><Input type="number" value={currentEmployeeData.salario || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, salario: e.target.value }))} /></div>
            <div>
              <Label>Setor</Label>
              <select value={currentEmployeeData.setor || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, setor: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border">
                <option value="" disabled>Selecione um setor</option>
                {companySectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>
          </div>
        );
      case 'CLT':
        return (
          <div className="space-y-4">
            <div><Label>Cargo</Label><Input value={currentEmployeeData.cargo || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, cargo: e.target.value }))} /></div>
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
      case 'Motoboy': return <Bike className="w-6 h-6 text-pink-600" />;
      case 'Freelancer': return <Users className="w-6 h-6 text-purple-600" />;
      case 'CLT': return <UserCheck className="w-6 h-6 text-sky-600" />;
      default: return <Users className="w-6 h-6 text-gray-600" />;
    }
  };
  
  const getEmployeeColor = (role) => {
    switch (role) {
      case 'Motoboy': return 'pink';
      case 'Freelancer': return 'purple';
      case 'CLT': return 'sky';
      default: return 'gray';
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Label htmlFor="company-select-func">Empresa</Label>
          <select id="company-select-func" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full sm:w-auto mt-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500">
            {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openDialog()} className="flex-1 gradient-primary text-white"><Plus className="w-4 h-4 mr-2" /> Novo Colaborador</Button>
          <Button onClick={openPaymentDialog} className="flex-1 gradient-success text-white"><Download className="w-4 h-4 mr-2" /> Fechar Semana</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p>Carregando...</p> : employees.map((emp, i) => (
          <motion.div key={emp.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={`glass-effect rounded-xl p-4 border-l-4 border-${getEmployeeColor(emp.role)}-500 relative`}>
            <div className="absolute top-1 right-1 flex">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(emp)}><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => { setEmployeeToDelete(emp); setIsDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-lg bg-${getEmployeeColor(emp.role)}-100`}>
                {getEmployeeIcon(emp.role)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{emp.name}</h3>
                <p className="text-sm text-gray-600">{emp.role} {emp.role === 'CLT' && emp.cargo && `(${emp.cargo})`} {emp.role === 'Freelancer' && emp.setor && `(${emp.setor})`}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500">PIX:</span> {emp.pix_key || 'N/A'}</p>
              {emp.role === 'Motoboy' && <p><span className="text-gray-500">Valores:</span> R${(emp.valor_encosta || 0).toFixed(2)} (diária) + R${(emp.valor_entrega || 0).toFixed(2)} (entrega)</p>}
              {emp.role === 'Freelancer' && <p><span className="text-gray-500">Valor:</span> R${(emp.salario || 0).toFixed(2)} / hora</p>}
              {emp.role === 'CLT' && <p><span className="text-gray-500">Custo Total:</span> R${calculateCltCost(emp).toFixed(2)}</p>}
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEmployee ? 'Editar' : 'Novo'} Colaborador</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome</Label><Input value={currentEmployeeData.name} onChange={e => setCurrentEmployeeData(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Chave PIX</Label><Input value={currentEmployeeData.pix_key || ''} onChange={e => setCurrentEmployeeData(p => ({ ...p, pix_key: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Função</Label>
              <select value={currentEmployeeData.role} onChange={e => setCurrentEmployeeData(p => ({ ...p, role: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border">
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
                <div key={emp.id} className="grid grid-cols-12 items-center gap-2 p-2 rounded-md hover:bg-gray-50">
                  <Label className="col-span-4">{emp.name}</Label>
                  <div className="col-span-2 text-center">{emp.units} {emp.role === 'Motoboy' ? 'entregas' : 'horas'}</div>
                  <div className="col-span-3">
                    <Input type="number" placeholder="Desconto (R$)" value={emp.discount} onChange={e => {
                      const newPaymentData = [...paymentData];
                      newPaymentData[index].discount = parseFloat(e.target.value) || 0;
                      setPaymentData(newPaymentData);
                    }} />
                  </div>
                  <div className="font-semibold text-right col-span-3">
                    R$ {
                      ((emp.role === 'Motoboy' ? (emp.valor_encosta || 0) + (emp.units * (emp.valor_entrega || 0)) : emp.units * (emp.salario || 0)) - (emp.discount || 0)).toFixed(2)
                    }
                  </div>
                </div>
              ))}
            </div>
            <div className="text-right font-bold text-lg pt-2 border-t">Total: R$ {paymentData.reduce((acc, p) => {
              const total = (p.role === 'Motoboy' ? (p.valor_encosta || 0) + (p.units * (p.valor_entrega || 0)) : p.units * (p.salario || 0));
              return acc + total - (p.discount || 0);
            }, 0).toFixed(2)}</div>
          </div>
          <DialogFooter><Button onClick={handleSendToConference}><Save className="w-4 h-4 mr-2" /> Enviar para Conferência</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pagamentos;