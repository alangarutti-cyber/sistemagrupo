import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/customSupabaseClient';

const AddWithdrawalForm = ({ companyId, onAdd, onCancel }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [value, setValue] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      if (!companyId) return;
      setLoading(true);
      const { data, error } = await supabase.from('employees').select('id, name').eq('company_id', companyId).order('name');
      if (error) toast({ title: "Erro ao buscar funcionários", description: error.message, variant: "destructive" });
      else setEmployees(data || []);
      setLoading(false);
    };
    fetchEmployees();
  }, [companyId]);

  const handleAdd = () => {
    const employee = employees.find(e => e.id == selectedEmployeeId);
    if (!employee || !value || parseFloat(value) <= 0) {
      toast({ title: "Dados inválidos", description: "Selecione um funcionário e um valor maior que zero.", variant: "destructive" });
      return;
    }
    onAdd({ id: Date.now(), employee, value: parseFloat(value), observations });
  };

  return (
    <div className="glass-effect rounded-xl p-4 space-y-4 border border-yellow-200">
      <h3 className="font-bold text-lg text-yellow-800">Adicionar Retirada</h3>
      <div className="space-y-4">
        <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-300">
          <option value="">Selecione um funcionário</option>
          {loading ? <option>Carregando...</option> : employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <Input type="number" placeholder="Valor (R$)" value={value} onChange={e => setValue(e.target.value)} />
        <textarea
          placeholder="Observações (opcional)"
          value={observations}
          onChange={e => setObservations(e.target.value)}
          rows={3}
          className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleAdd}>Adicionar</Button>
      </div>
    </div>
  );
};

export default AddWithdrawalForm;