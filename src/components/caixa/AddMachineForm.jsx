import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/customSupabaseClient';

const AddMachineForm = ({ companyId, onMachineAdd, existingMachineIds, onCancel }) => {
  const [cardMachines, setCardMachines] = useState([]);
  const [allPaymentMethods, setAllPaymentMethods] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [paymentValues, setPaymentValues] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setSelectedMachineId('');
    setPaymentValues([]);

    const { data: machinesData, error: machinesError } = await supabase
      .from('card_machines')
      .select('*, operator:card_operators(id, name)')
      .eq('company_id', companyId);

    if (machinesError) {
      toast({ title: "Erro ao buscar máquinas", description: machinesError.message, variant: "destructive" });
      setCardMachines([]);
    } else {
      setCardMachines(machinesData.filter(m => !existingMachineIds.includes(m.id)) || []);
    }

    const { data: methodsData, error: methodsError } = await supabase
      .from('payment_methods')
      .select('*');
      
    if (methodsError) {
      toast({ title: "Erro ao buscar formas de pagamento", description: methodsError.message, variant: "destructive" });
      setAllPaymentMethods([]);
    } else {
      setAllPaymentMethods(methodsData || []);
    }

    setLoading(false);
  }, [companyId, existingMachineIds, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const machine = cardMachines.find(m => m.id == selectedMachineId);
    const operatorId = machine?.operator?.id;
    if (operatorId) {
      const filteredMethods = allPaymentMethods.filter(pm => pm.operator_id === operatorId);
      setPaymentValues(filteredMethods.map(pm => ({ ...pm, value: 0 })));
    } else {
      setPaymentValues([]);
    }
  }, [selectedMachineId, cardMachines, allPaymentMethods]);

  const handleValueChange = (id, value) => {
    const newValue = parseFloat(value) || 0;
    setPaymentValues(paymentValues.map(pv => pv.id === id ? { ...pv, value: newValue } : pv));
  };

  const handleAdd = () => {
    const machine = cardMachines.find(m => m.id == selectedMachineId);
    const payments = paymentValues.filter(pv => pv.value > 0);
    if (!machine || payments.length === 0) {
      toast({ title: "Valores não preenchidos", description: "Preencha o valor para ao menos uma forma de pagamento.", variant: "destructive" });
      return;
    }
    onMachineAdd({ machine, payments });
    setSelectedMachineId('');
    setPaymentValues([]);
  };

  return (
    <div className="glass-effect rounded-xl p-4 space-y-4 border border-blue-200">
      <h3 className="font-bold text-lg text-blue-800">Adicionar Máquina de Cartão</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Máquina</label>
          <select value={selectedMachineId} onChange={(e) => setSelectedMachineId(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-300">
            <option value="">Selecione uma máquina</option>
            {loading ? <option>Carregando...</option> : cardMachines.map(m => <option key={m.id} value={m.id}>{m.serial_number} ({m.machine_number})</option>)}
          </select>
        </div>
        {paymentValues.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Formas de Pagamento ({cardMachines.find(m => m.id == selectedMachineId)?.operator?.name})</h4>
            {paymentValues.map(pv => (
              <div key={pv.id} className="flex items-center justify-between gap-4">
                <label htmlFor={`payment-${pv.id}`} className="flex-1">{pv.name}</label>
                <Input id={`payment-${pv.id}`} type="number" step="0.01" value={pv.value} onChange={(e) => handleValueChange(pv.id, e.target.value)} className="max-w-[120px]" placeholder="0,00" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleAdd} disabled={!selectedMachineId || paymentValues.length === 0}>Adicionar</Button>
      </div>
    </div>
  );
};

export default AddMachineForm;