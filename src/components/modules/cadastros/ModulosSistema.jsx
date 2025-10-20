import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const ModulosSistema = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialState, setInitialState] = useState({});

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, name, path, is_active')
        .order('name', { ascending: true });

      if (error) throw error;

      const modulesWithState = data.map(m => ({ ...m, is_active: m.is_active ?? true }));
      setModules(modulesWithState);
      
      const initial = modulesWithState.reduce((acc, m) => {
        acc[m.id] = m.is_active;
        return acc;
      }, {});
      setInitialState(initial);

    } catch (error) {
      toast({
        title: 'Erro ao buscar módulos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (moduleId) => {
    setModules(prevModules =>
      prevModules.map(m =>
        m.id === moduleId ? { ...m, is_active: !m.is_active } : m
      )
    );
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const updates = modules
        .filter(m => m.is_active !== initialState[m.id])
        .map(m => ({
          id: m.id,
          is_active: m.is_active,
        }));

      if (updates.length === 0) {
        toast({ title: 'Nenhuma alteração para salvar.' });
        return;
      }

      const { error } = await supabase.from('modules').upsert(updates);

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: 'Visibilidade dos módulos atualizada. As alterações serão aplicadas no próximo login ou ao recarregar a página.',
      });
      
      const newInitialState = modules.reduce((acc, m) => {
        acc[m.id] = m.is_active;
        return acc;
      }, {});
      setInitialState(newInitialState);

    } catch (error) {
      toast({
        title: 'Erro ao salvar alterações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Módulos do Sistema</CardTitle>
          <p className="text-muted-foreground">Selecione os módulos que devem aparecer no menu lateral.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {modules.map(module => (
              <div key={module.id} className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  id={`module-${module.id}`}
                  checked={module.is_active}
                  onCheckedChange={() => handleToggle(module.id)}
                  disabled={module.path === 'dashboard' || module.path === 'cadastros'}
                />
                <Label htmlFor={`module-${module.id}`} className="flex-1 cursor-pointer">
                  {module.name}
                </Label>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveChanges} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ModulosSistema;