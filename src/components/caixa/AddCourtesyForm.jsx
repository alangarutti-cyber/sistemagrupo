import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';

const AddCourtesyForm = ({ onAdd, onCancel }) => {
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');

  const handleAdd = () => {
    if (!description || !value || parseFloat(value) <= 0) {
      toast({ title: "Dados inválidos", description: "Preencha a descrição e um valor maior que zero.", variant: "destructive" });
      return;
    }
    onAdd({ id: Date.now(), description, value: parseFloat(value) });
  };

  return (
    <div className="glass-effect rounded-xl p-4 space-y-4 border border-purple-200">
      <h3 className="font-bold text-lg text-purple-800">Adicionar Cortesia</h3>
      <div className="space-y-4">
        <Input placeholder="Descrição (ex: Cliente VIP)" value={description} onChange={e => setDescription(e.target.value)} />
        <Input type="number" placeholder="Valor (R$)" value={value} onChange={e => setValue(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleAdd} className="bg-purple-500 hover:bg-purple-600">Adicionar</Button>
      </div>
    </div>
  );
};

export default AddCourtesyForm;