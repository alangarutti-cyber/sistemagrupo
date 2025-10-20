import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Edit, Trash2, Scale, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
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

const UnidadesMedida = ({ user }) => {
  const { toast } = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbreviation, setNewUnitAbbreviation] = useState('');
  const [editingUnit, setEditingUnit] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, unitId: null });

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('units_of_measure')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      toast({
        title: 'Erro ao carregar unidades de medida',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setUnits(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleAddUnit = async () => {
    if (!newUnitName.trim() || !newUnitAbbreviation.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e abreviação da unidade não podem ser vazios.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('units_of_measure')
      .insert({ name: newUnitName.trim(), abbreviation: newUnitAbbreviation.trim() })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao adicionar unidade',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setUnits(prev => [...prev, data]);
      setNewUnitName('');
      setNewUnitAbbreviation('');
      toast({
        title: 'Unidade adicionada!',
        description: `"${data.name}" (${data.abbreviation}) foi adicionada com sucesso.`,
      });
    }
    setLoading(false);
  };

  const handleEditUnit = (unit) => {
    setEditingUnit({ ...unit });
  };

  const handleUpdateUnit = async () => {
    if (!editingUnit.name.trim() || !editingUnit.abbreviation.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e abreviação da unidade não podem ser vazios.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('units_of_measure')
      .update({ name: editingUnit.name.trim(), abbreviation: editingUnit.abbreviation.trim() })
      .eq('id', editingUnit.id)
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao atualizar unidade',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setUnits(prev => prev.map(u => (u.id === data.id ? data : u)));
      setEditingUnit(null);
      toast({
        title: 'Unidade atualizada!',
        description: `"${data.name}" (${data.abbreviation}) foi atualizada com sucesso.`,
      });
    }
    setLoading(false);
  };

  const handleDeleteUnit = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('units_of_measure')
      .delete()
      .eq('id', deleteConfirmation.unitId);

    if (error) {
      toast({
        title: 'Erro ao remover unidade',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setUnits(prev => prev.filter(u => u.id !== deleteConfirmation.unitId));
      toast({
        title: 'Unidade removida!',
        description: 'A unidade de medida foi removida com sucesso.',
      });
    }
    setDeleteConfirmation({ isOpen: false, unitId: null });
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Unidades de Medida - Stout System</title>
        <meta name="description" content="Gerencie as unidades de medida para seus produtos no Stout System." />
      </Helmet>
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <h1 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
          <Scale className="w-8 h-8" />
          Unidades de Medida
        </h1>

        <div className="bg-card p-6 rounded-xl shadow-sm mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Adicionar Nova Unidade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Nome da Unidade (ex: Quilograma)"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              disabled={loading}
              className="col-span-1 md:col-span-1"
            />
            <Input
              placeholder="Abreviação (ex: KG)"
              value={newUnitAbbreviation}
              onChange={(e) => setNewUnitAbbreviation(e.target.value)}
              disabled={loading}
              className="col-span-1 md:col-span-1"
            />
            <Button onClick={handleAddUnit} disabled={loading} className="col-span-1 md:col-span-1">
              <PlusCircle className="w-4 h-4 mr-2" />
              {loading && !editingUnit ? 'Adicionando...' : 'Adicionar Unidade'}
            </Button>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-4">Unidades Existentes</h2>
          {loading && (
            <p className="text-muted-foreground text-center">Carregando unidades...</p>
          )}
          {!loading && units.length === 0 && (
            <p className="text-muted-foreground text-center">Nenhuma unidade de medida cadastrada ainda.</p>
          )}
          <AnimatePresence>
            <div className="space-y-3">
              {units.map((unit) => (
                <motion.div
                  key={unit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  layout
                  className="flex flex-col sm:flex-row items-center justify-between p-4 bg-background rounded-lg border border-border"
                >
                  {editingUnit && editingUnit.id === unit.id ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                      <Input
                        value={editingUnit.name}
                        onChange={(e) => setEditingUnit(prev => ({ ...prev, name: e.target.value }))}
                        disabled={loading}
                        className="flex-grow"
                      />
                      <Input
                        value={editingUnit.abbreviation}
                        onChange={(e) => setEditingUnit(prev => ({ ...prev, abbreviation: e.target.value }))}
                        disabled={loading}
                        className="w-full sm:w-24"
                      />
                      <div className="flex gap-2 mt-2 sm:mt-0">
                        <Button onClick={handleUpdateUnit} disabled={loading} size="icon">
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" onClick={() => setEditingUnit(null)} disabled={loading} size="icon">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-grow text-center sm:text-left mb-2 sm:mb-0">
                        <p className="font-semibold text-foreground">{unit.name}</p>
                        <p className="text-sm text-muted-foreground">Abreviação: {unit.abbreviation}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleEditUnit(unit)} disabled={loading}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => setDeleteConfirmation({ isOpen: true, unitId: unit.id })} disabled={loading}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </div>
      </div>

      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso removerá permanentemente esta unidade de medida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmation({ isOpen: false, unitId: null })}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUnit} disabled={loading}>
              {loading ? 'Removendo...' : 'Sim, remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UnidadesMedida;