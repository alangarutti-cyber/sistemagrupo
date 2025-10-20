import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, PlusCircle, Save, Trash2, Edit, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from '@/components/ui/checkbox';

const VinculoWhatsApp = ({ users, companies }) => {
  const { toast } = useToast();
  const [vinculos, setVinculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentVinculo, setCurrentVinculo] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchVinculos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('user_whatsapp').select('*, app_users(id, name), companies(id, name)');
    if (error) {
      toast({ title: 'Erro ao buscar vínculos', description: error.message, variant: 'destructive' });
    } else {
      setVinculos(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVinculos();
  }, [toast]);

  const handleOpenModal = (vinculo = null) => {
    if (vinculo) {
      setCurrentVinculo({
        id: vinculo.id,
        phone_norm: vinculo.phone_norm,
        user_id: vinculo.user_id,
        company_id: vinculo.company_id,
        is_active: vinculo.is_active,
      });
    } else {
      setCurrentVinculo({ id: null, phone_norm: '', user_id: null, company_id: null, is_active: true });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!currentVinculo.phone_norm || !currentVinculo.user_id || !currentVinculo.company_id) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha telefone, usuário e empresa.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    
    const vinculoData = {
        phone_norm: currentVinculo.phone_norm.replace(/\D/g, ''),
        user_id: currentVinculo.user_id,
        company_id: currentVinculo.company_id,
        is_active: currentVinculo.is_active,
    };

    const { error } = currentVinculo.id
      ? await supabase.from('user_whatsapp').update(vinculoData).eq('id', currentVinculo.id)
      : await supabase.from('user_whatsapp').insert(vinculoData);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso!', description: 'Vínculo salvo.', className: 'bg-green-500 text-white' });
      setIsModalOpen(false);
      fetchVinculos();
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este vínculo?')) return;
    const { error } = await supabase.from('user_whatsapp').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso!', description: 'Vínculo removido.' });
      fetchVinculos();
    }
  };

  const sortedUsers = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name)), [users]);
  const sortedCompanies = useMemo(() => companies.slice().sort((a, b) => a.name.localeCompare(b.name)), [companies]);
  
  return (
    <motion.div>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Vínculos de WhatsApp</h2>
            <Button onClick={() => handleOpenModal()}><PlusCircle className="mr-2 h-4 w-4"/> Novo Vínculo</Button>
        </div>
        
        {loading ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
            <div className="space-y-2">
                {vinculos.map(vinculo => (
                    <div key={vinculo.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                            <p className="font-semibold text-lg">{vinculo.app_users?.name || 'Usuário Removido'}</p>
                            <p className="text-sm text-muted-foreground">Telefone: +{vinculo.phone_norm}</p>
                            <p className="text-sm text-muted-foreground">Empresa: {vinculo.companies?.name || 'Empresa Removida'}</p>
                        </div>
                         <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${vinculo.is_active ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                {vinculo.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(vinculo)}><Edit className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(vinculo.id)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{currentVinculo?.id ? 'Editar Vínculo' : 'Novo Vínculo'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Telefone (com DDI e DDD)</Label>
                        <Input id="phone" value={currentVinculo?.phone_norm} onChange={e => setCurrentVinculo({...currentVinculo, phone_norm: e.target.value})} placeholder="Ex: 5511987654321"/>
                    </div>
                    <div className="space-y-2">
                        <Label>Usuário</Label>
                        <Combobox data={sortedUsers} value={currentVinculo?.user_id} onSelect={value => setCurrentVinculo({...currentVinculo, user_id: value})} placeholder="Selecione um usuário..."/>
                    </div>
                    <div className="space-y-2">
                        <Label>Empresa</Label>
                        <Combobox data={sortedCompanies} value={currentVinculo?.company_id} onSelect={value => setCurrentVinculo({...currentVinculo, company_id: value})} placeholder="Selecione uma empresa..."/>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Checkbox id="is_active" checked={currentVinculo?.is_active} onCheckedChange={checked => setCurrentVinculo({...currentVinculo, is_active: checked})} />
                        <label htmlFor="is_active" className="text-sm font-medium leading-none">Vínculo ativo</label>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline"><X className="mr-2 h-4 w-4"/> Cancelar</Button></DialogClose>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </motion.div>
  );
};

const Combobox = ({ data, value, onSelect, placeholder }) => {
    const [open, setOpen] = useState(false);
    const selected = data.find(item => item.id === value);
    
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                    {selected ? selected.name : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Pesquisar..." />
                    <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                        {data.map((item) => (
                            <CommandItem key={item.id} value={item.name} onSelect={() => { onSelect(item.id); setOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                                {item.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default VinculoWhatsApp;