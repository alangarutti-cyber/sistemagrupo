import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Save, Calendar, User, Hash, MessageSquare, DollarSign, MinusCircle, Clock, Users, Send, Trash2, Edit } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    
    const formatCurrency = (value) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return 'R$ 0,00';
        }
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const Lancamentos = ({ user, companies, userCompanyAccess }) => {
      const { toast } = useToast();
      const [activeTab, setActiveTab] = useState('motoboys');
      const [employees, setEmployees] = useState([]);
      const [loading, setLoading] = useState(true);
      const [selectedCompany, setSelectedCompany] = useState('');
      
      const [selectedEntryId, setSelectedEntryId] = useState(null);
      const [selectedEmployee, setSelectedEmployee] = useState('');
      const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
      const [deliveries, setDeliveries] = useState('');
      const [horaEntrada, setHoraEntrada] = useState('');
      const [horaSaida, setHoraSaida] = useState('');
      const [desconto, setDesconto] = useState('');
      const [observations, setObservations] = useState('');
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [totalReceber, setTotalReceber] = useState(0);
    
      const [dailyEntries, setDailyEntries] = useState([]);
      const [loadingEntries, setLoadingEntries] = useState(false);
      const [entryToDelete, setEntryToDelete] = useState(null);

      const [allowedCompanies, setAllowedCompanies] = useState([]);

      useEffect(() => {
        if (user && companies && userCompanyAccess) {
          if (user.is_admin || user.role === 'Super Administrador') {
            setAllowedCompanies(companies);
          } else {
            const userCompanyIds = userCompanyAccess
              .filter(access => access.user_id === user.id)
              .map(access => access.company_id);
            const accessibleCompanies = companies.filter(c => userCompanyIds.includes(c.id));
            setAllowedCompanies(accessibleCompanies);
          }
        }
      }, [user, companies, userCompanyAccess]);
    
      useEffect(() => {
        if (allowedCompanies.length > 0 && !selectedCompany) {
          setSelectedCompany(allowedCompanies[0].id);
        }
      }, [allowedCompanies, selectedCompany]);
      
      const clearForm = useCallback(() => {
        setSelectedEntryId(null);
        setSelectedEmployee('');
        setDeliveries('');
        setHoraEntrada('');
        setHoraSaida('');
        setDesconto('');
        setObservations('');
        setTotalReceber(0);
      }, []);
      
      const fetchDailyEntries = useCallback(async () => {
        if (!selectedCompany || !entryDate) return;
        setLoadingEntries(true);
        const { data, error } = await supabase
          .from('daily_entries')
          .select('*, employee_name, employee:employees(role)')
          .eq('company_id', selectedCompany)
          .eq('entry_date', entryDate);
    
        if (error) {
          toast({ title: "Erro ao buscar lançamentos do dia", description: error.message, variant: "destructive" });
          setDailyEntries([]);
        } else {
          setDailyEntries(data || []);
        }
        setLoadingEntries(false);
      }, [selectedCompany, entryDate, toast]);
    
      const fetchEmployees = useCallback(async () => {
        if (!selectedCompany) return;
        setLoading(true);
        const roleFilter = activeTab === 'motoboys' ? 'Motoboy' : 'Freelancer';
        const { data, error } = await supabase
          .from('employees')
          .select('id, name, role, valor_encosta, valor_entrega, valor_hora, valor_fixo, setor')
          .eq('company_id', selectedCompany)
          .eq('role', roleFilter)
          .order('name');
          
        if (error) {
          toast({ title: `Erro ao buscar ${roleFilter}s`, description: error.message, variant: "destructive" });
        } else {
          setEmployees(data);
        }
        setLoading(false);
      }, [selectedCompany, toast, activeTab]);
    
      useEffect(() => {
        fetchEmployees();
        if (selectedCompany) {
            clearForm();
        }
      }, [selectedCompany, activeTab, clearForm]);
      
      useEffect(() => {
        fetchDailyEntries();
      }, [fetchDailyEntries]);
    
      const calculateTotal = useCallback((entry = null) => {
        const employeeIdToFind = entry ? entry.employee_id : parseInt(selectedEmployee);
        if (!employeeIdToFind) return 0;
        
        let employeeToCalc;
        
        if (entry) {
          employeeToCalc = {
              id: entry.employee_id,
              role: entry.employee?.role,
              valor_encosta: entry.valor_encosta || 0,
              valor_entrega: entry.valor_entrega || 0,
              valor_fixo: entry.valor_fixo || 0,
              valor_hora: entry.valor_hora || 0,
          };

          const fullEmployeeData = employees.find(e => e.id === entry.employee_id);
          if (fullEmployeeData) {
              employeeToCalc = { ...employeeToCalc, ...fullEmployeeData };
          }
        } else {
            employeeToCalc = employees.find(e => e.id === employeeIdToFind);
        }
    
        if (!employeeToCalc) return 0;
    
        let total = 0;
        const discountValue = parseFloat(entry ? entry.desconto : desconto) || 0;
    
        if (employeeToCalc.role === 'Motoboy') {
            const valorDiaria = employeeToCalc.valor_encosta || 0;
            const valorEntrega = employeeToCalc.valor_entrega || 0;
            const numEntregas = parseFloat(entry ? entry.units : deliveries) || 0;
            total = valorDiaria + (numEntregas * valorEntrega);
        } else if (employeeToCalc.role === 'Freelancer') {
            const valorFixo = employeeToCalc.valor_fixo || 0;
            const valorHora = employeeToCalc.valor_hora || 0;
            let hoursWorked = 0;
            const he = entry ? entry.hora_entrada : horaEntrada;
            const hs = entry ? entry.hora_saida : horaSaida;
            if (he && hs) {
                const [startH, startM] = he.split(':').map(Number);
                const [endH, endM] = hs.split(':').map(Number);
                const startDate = new Date(0, 0, 0, startH, startM, 0);
                const endDate = new Date(0, 0, 0, endH, endM, 0);
                let diff = endDate.getTime() - startDate.getTime();
                if (diff < 0) { // overnight
                    diff += 24 * 60 * 60 * 1000;
                }
                hoursWorked = diff / (1000 * 60 * 60);
            }
            total = valorFixo + (hoursWorked * valorHora);
        }
        
        return total - discountValue;
    }, [selectedEmployee, deliveries, horaEntrada, horaSaida, desconto, employees]);
    
      useEffect(() => {
        setTotalReceber(calculateTotal());
      }, [calculateTotal, deliveries, horaEntrada, horaSaida, desconto, selectedEmployee]);
    
      const loadEntryForEdit = async (entry) => {
          const employeeRole = entry.employee?.role;
          if (!employeeRole) {
              toast({ title: "Erro de dados", description: "Não foi possível identificar o cargo do funcionário para este lançamento.", variant: "destructive" });
              return;
          }
      
          const targetTab = employeeRole === 'Motoboy' ? 'motoboys' : 'freelancers';
      
          const switchTabAndLoad = () => {
              setSelectedEntryId(entry.id);
              setEntryDate(entry.entry_date);
              setDeliveries(entry.units || '');
              setHoraEntrada(entry.hora_entrada || '');
              setHoraSaida(entry.hora_saida || '');
              setDesconto(entry.desconto || '');
              setObservations(entry.observations || '');
      
              setTimeout(() => {
                  setSelectedEmployee(entry.employee_id);
              }, 100);
          };
      
          if (activeTab !== targetTab) {
              setActiveTab(targetTab);
              setTimeout(switchTabAndLoad, 50); 
          } else {
              switchTabAndLoad();
          }
      };
    
      const validateForm = () => {
        if (!selectedEmployee || !entryDate) {
          toast({ title: "Campos obrigatórios", description: "Selecione o funcionário e a data.", variant: "warning" });
          return false;
        }
        
        const employee = employees.find(e => e.id === parseInt(selectedEmployee));
        if(!employee) {
          toast({ title: "Funcionário inválido", description: "O funcionário selecionado não foi encontrado.", variant: "warning" });
          return false;
        }

        const isMotoboyInvalid = employee.role === 'Motoboy' && (deliveries === '' || deliveries === null);
        const isFreelancerInvalid = employee.role === 'Freelancer' && (!horaEntrada || !horaSaida);
    
        if (isMotoboyInvalid || isFreelancerInvalid) {
            toast({ title: "Campos obrigatórios", description: "Preencha os dados de lançamento (entregas ou horas).", variant: "warning" });
            return false;
        }
        return true;
      };
    
      const saveDailyEntry = async () => {
        const employee = employees.find(e => e.id === parseInt(selectedEmployee));
        if (!employee) {
            toast({ title: "Erro", description: "Funcionário selecionado não encontrado.", variant: "destructive" });
            return { data: null, error: { message: "Funcionário não encontrado" }};
        }
        const entryData = {
          id: selectedEntryId || undefined,
          company_id: selectedCompany,
          employee_id: selectedEmployee,
          entry_date: entryDate,
          units: parseFloat(deliveries) || 0,
          hora_entrada: employee.role === 'Freelancer' ? horaEntrada : null,
          hora_saida: employee.role === 'Freelancer' ? horaSaida : null,
          desconto: parseFloat(desconto) || null,
          observations: observations,
          user_id: user.id
        };
    
        const { data, error } = await supabase
          .from('daily_entries')
          .upsert(entryData, { onConflict: 'id' })
          .select()
          .single();

        return { data, error };
      };
    
      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
    
        setIsSubmitting(true);
        const { error } = await saveDailyEntry();
        if (error) {
          toast({ title: "Erro ao salvar lançamento", description: error.message, variant: "destructive" });
        } else {
          toast({ title: selectedEntryId ? "Lançamento atualizado!" : "Lançamento salvo com sucesso!", variant: "success" });
          clearForm();
          fetchDailyEntries();
        }
        setIsSubmitting(false);
      };
    
      const handleSendToConference = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
    
        setIsSubmitting(true);
        const { data: savedEntry, error: entryError } = await saveDailyEntry();
        if (entryError) {
          toast({ title: "Erro ao salvar lançamento", description: entryError.message, variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
    
        const employee = employees.find(e => e.id === parseInt(selectedEmployee));
        const totalValue = calculateTotal();
        const discountValue = parseFloat(desconto) || 0;
    
        let hoursWorked = 0;
        if (employee.role === 'Freelancer' && horaEntrada && horaSaida) {
            const [startH, startM] = horaEntrada.split(':').map(Number);
            const [endH, endM] = horaSaida.split(':').map(Number);
            const startDate = new Date(0, 0, 0, startH, startM, 0);
            const endDate = new Date(0, 0, 0, endH, endM, 0);
            let diff = endDate.getTime() - startDate.getTime();
            if (diff < 0) diff += 24 * 60 * 60 * 1000;
            hoursWorked = diff / (1000 * 60 * 60);
        }
    
        const paymentDetails = [{
          employee_id: employee.id,
          name: employee.name,
          role: employee.role,
          setor: employee.setor,
          deliveries: employee.role === 'Motoboy' ? parseFloat(deliveries) || 0 : 0,
          hours: hoursWorked,
          fixed_value: employee.role === 'Freelancer' ? employee.valor_fixo || 0 : 0,
          discount: discountValue,
          total: totalValue
        }];
    
        const { error: paymentError } = await supabase.from('employee_payments').insert({
          company_id: selectedCompany,
          user_id: user.id,
          start_date: entryDate,
          end_date: entryDate,
          total_value: totalValue,
          payment_details: paymentDetails,
          status: 'Pendente',
          descontos: discountValue
        });
    
        if (paymentError) {
          toast({ title: "Erro ao enviar para conferência", description: paymentError.message, variant: "destructive" });
        } else {
          toast({ title: "Enviado para Conferência!", description: "O pagamento agora está pendente de aprovação.", variant: "success" });
          clearForm();
          fetchDailyEntries();
        }
        setIsSubmitting(false);
      };
      
      const handleDeleteEntry = async () => {
        if (!entryToDelete) return;
        
        const { error } = await supabase
          .from('daily_entries')
          .delete()
          .eq('id', entryToDelete.id);
          
        if (error) {
          toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Lançamento excluído com sucesso!", variant: "success" });
          fetchDailyEntries();
        }
        setEntryToDelete(null);
      };
    
      const renderMotoboyForm = () => (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="deliveries" className="flex items-center gap-2"><Hash className="w-4 h-4" /> Nº de Entregas</Label>
              <Input id="deliveries" type="number" value={deliveries} onChange={(e) => setDeliveries(e.target.value)} placeholder="Digite a quantidade" className="mt-1" disabled={!selectedEmployee} />
            </div>
            <div>
              <Label htmlFor="desconto-moto" className="flex items-center gap-2"><MinusCircle className="w-4 h-4" /> Desconto (R$)</Label>
              <Input id="desconto-moto" type="number" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="Ex: 10.50" className="mt-1" disabled={!selectedEmployee} />
            </div>
          </div>
        </div>
      );
    
      const renderFreelancerForm = () => (
        <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="hora-entrada" className="flex items-center gap-2"><Clock className="w-4 h-4" /> Hora de Entrada</Label>
              <Input id="hora-entrada" type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} className="mt-1" disabled={!selectedEmployee} />
            </div>
            <div>
              <Label htmlFor="hora-saida" className="flex items-center gap-2"><Clock className="w-4 h-4" /> Hora de Saída</Label>
              <Input id="hora-saida" type="time" value={horaSaida} onChange={(e) => setHoraSaida(e.target.value)} className="mt-1" disabled={!selectedEmployee} />
            </div>
          </div>
          <div>
            <Label htmlFor="desconto-free" className="flex items-center gap-2"><MinusCircle className="w-4 h-4" /> Desconto (R$)</Label>
            <Input id="desconto-free" type="number" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="Ex: 10.50" className="mt-1" disabled={!selectedEmployee} />
          </div>
        </div>
      );
    
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="container mx-auto p-4"
        >
          <div className="max-w-4xl mx-auto p-6 bg-card text-card-foreground rounded-xl shadow-lg">
              <h1 className="text-2xl font-bold mb-6">{selectedEntryId ? 'Editando Lançamento' : 'Lançamentos Diários'}</h1>
              
              <Tabs value={activeTab} onValueChange={(tab) => { clearForm(); setActiveTab(tab); }} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="motoboys"><User className="w-4 h-4 mr-2" />Motoboys</TabsTrigger>
                  <TabsTrigger value="freelancers"><Users className="w-4 h-4 mr-2" />Freelancers</TabsTrigger>
                </TabsList>
                <form className="space-y-6 mt-6">
                  <div>
                    <Label htmlFor="company-select-lanc">Empresa</Label>
                    <select id="company-select-lanc" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full mt-1 px-4 py-2 rounded-lg border bg-background border-border focus:ring-2 focus:ring-primary">
                      {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
        
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="employee-select" className="flex items-center gap-2"><User className="w-4 h-4" /> Funcionário</Label>
                      <select id="employee-select" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="w-full mt-1 px-4 py-2 rounded-lg border bg-background border-border focus:ring-2 focus:ring-primary" disabled={loading}>
                        <option value="" disabled>{loading ? 'Carregando...' : `Selecione o ${activeTab === 'motoboys' ? 'motoboy' : 'freelancer'}`}</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="entry-date" className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Data</Label>
                      <Input id="entry-date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  
                  <TabsContent value="motoboys">{renderMotoboyForm()}</TabsContent>
                  <TabsContent value="freelancers">{renderFreelancerForm()}</TabsContent>
        
                  <div>
                    <Label className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> Total a Receber</Label>
                    <div className="mt-1 w-full px-4 py-2 rounded-lg border border-border bg-muted font-bold text-lg text-green-600">
                      {formatCurrency(totalReceber)}
                    </div>
                  </div>
        
                  <div>
                    <Label htmlFor="observations" className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Observações</Label>
                    <Textarea id="observations" value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Adicione uma observação (opcional)" className="mt-1" disabled={!selectedEmployee} />
                  </div>
        
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" onClick={clearForm} variant="ghost" disabled={isSubmitting}>
                      {selectedEntryId ? 'Cancelar Edição' : 'Limpar'}
                    </Button>
                    <Button type="button" onClick={handleSubmit} variant="outline" disabled={isSubmitting}>
                      <Save className="w-4 h-4 mr-2" />
                      {isSubmitting ? 'Salvando...' : (selectedEntryId ? 'Atualizar' : 'Salvar')}
                    </Button>
                    <Button type="button" onClick={handleSendToConference} className="bg-primary text-primary-foreground" disabled={isSubmitting}>
                      <Send className="w-4 h-4 mr-2" />
                      {isSubmitting ? 'Enviando...' : (selectedEntryId ? 'Atualizar e Enviar' : 'Salvar e Enviar')}
                    </Button>
                  </div>
                </form>
              </Tabs>
          </div>
          
          <div className="max-w-4xl mx-auto mt-8 p-6 bg-card text-card-foreground rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-4">Lançamentos em {new Date(entryDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</h2>
            {loadingEntries ? (
                <p>Carregando lançamentos...</p>
            ) : dailyEntries.length > 0 ? (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Detalhes</TableHead>
                            <TableHead>Desconto</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Ações</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {dailyEntries.map(entry => (
                            <TableRow key={entry.id}>
                            <TableCell>{entry.employee_name || 'Nome não encontrado'}</TableCell>
                            <TableCell>
                                {entry.units > 0 ? `${entry.units} entregas` : `${entry.hora_entrada || ''} - ${entry.hora_saida || ''}`}
                            </TableCell>
                            <TableCell>{formatCurrency(entry.desconto || 0)}</TableCell>
                            <TableCell>{formatCurrency(calculateTotal(entry))}</TableCell>
                            <TableCell className="flex gap-2">
                                <Button variant="ghost" size="icon" onClick={() => loadEntryForEdit(entry)}>
                                <Edit className="w-4 h-4 text-blue-500" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setEntryToDelete(entry)}>
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação não pode ser desfeita. Isso irá excluir permanentemente o lançamento.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setEntryToDelete(null)}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteEntry}>Excluir</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <p className="text-muted-foreground text-center">Nenhum lançamento encontrado para esta data.</p>
            )}
          </div>
        </motion.div>
      );
    };
    
    export default Lancamentos;