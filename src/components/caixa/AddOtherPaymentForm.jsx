import React, { useState, useEffect } from 'react';
    import { Button } from '@/components/ui/button';
    import { toast } from '@/components/ui/use-toast';
    import { Input } from '@/components/ui/input';
    import { supabase } from '@/lib/customSupabaseClient';

    const AddOtherPaymentForm = ({ companyId, onPaymentAdd, existingOperatorIds, onCancel }) => {
      const [cardOperators, setCardOperators] = useState([]);
      const [allPaymentMethods, setAllPaymentMethods] = useState([]);
      const [selectedOperatorId, setSelectedOperatorId] = useState('');
      const [paymentValues, setPaymentValues] = useState([]);
      const [loading, setLoading] = useState(false);

      useEffect(() => {
        if (companyId) {
          const fetchData = async () => {
            setLoading(true);
            
            const { data: operatorsData, error: operatorsError } = await supabase
              .from('card_operator_company_access')
              .select('operator:card_operators(*)')
              .eq('company_id', companyId);

            if (operatorsError) {
              toast({ title: "Erro ao buscar operadores", description: operatorsError.message, variant: "destructive" });
            } else {
              const availableOperators = operatorsData
                .map(item => item.operator)
                .filter(op => op && !existingOperatorIds.includes(op.id));
              setCardOperators(availableOperators || []);
            }

            const { data: methodsData, error: methodsError } = await supabase
              .from('payment_method_company_access')
              .select('method:payment_methods(*)')
              .eq('company_id', companyId);

            if (methodsError) {
              toast({ title: "Erro ao buscar formas de pagamento", description: methodsError.message, variant: "destructive" });
            } else {
              setAllPaymentMethods(methodsData.map(item => item.method).filter(Boolean) || []);
            }

            setLoading(false);
          };
          fetchData();
        }
      }, [companyId, existingOperatorIds, toast]);

      useEffect(() => {
        if (selectedOperatorId) {
          const filteredMethods = allPaymentMethods.filter(pm => pm.operator_id == selectedOperatorId);
          setPaymentValues(filteredMethods.map(pm => ({ ...pm, value: 0 })));
        } else {
          setPaymentValues([]);
        }
      }, [selectedOperatorId, allPaymentMethods]);

      const handleValueChange = (id, value) => {
        const newValue = parseFloat(value) || 0;
        setPaymentValues(paymentValues.map(pv => pv.id === id ? { ...pv, value: newValue } : pv));
      };

      const handleAdd = () => {
        const operator = cardOperators.find(op => op.id == selectedOperatorId);
        const payments = paymentValues.filter(pv => pv.value > 0);
        if (!operator || payments.length === 0) {
          toast({ title: "Valores não preenchidos", description: "Selecione um operador e preencha o valor para ao menos uma forma de pagamento.", variant: "destructive" });
          return;
        }
        onPaymentAdd({ operator, payments });
        setSelectedOperatorId('');
        setPaymentValues([]);
      };

      return (
        <div className="glass-effect rounded-xl p-4 space-y-4 border border-purple-200">
          <h3 className="font-bold text-lg text-purple-800">Adicionar Outro Pagamento (Ex: Link, Online)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operador</label>
              <select value={selectedOperatorId} onChange={(e) => setSelectedOperatorId(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-300">
                <option value="">Selecione um operador</option>
                {loading ? <option>Carregando...</option> : cardOperators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
            </div>
            {paymentValues.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Formas de Pagamento ({cardOperators.find(op => op.id == selectedOperatorId)?.name})</h4>
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
            <Button onClick={handleAdd} disabled={!selectedOperatorId || paymentValues.length === 0}>Adicionar</Button>
          </div>
        </div>
      );
    };

    export default AddOtherPaymentForm;