import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Save, Copy, Info } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Checkbox } from '@/components/ui/checkbox';
    import {
      Dialog,
      DialogContent,
      DialogHeader,
      DialogTitle,
      DialogTrigger,
    } from "@/components/ui/dialog";

    const PermissoesTab = ({ users, onDataUpdate }) => {
      const { toast } = useToast();
      const [modules, setModules] = useState([]);
      const [selectedUser, setSelectedUser] = useState('');
      const [userPermissions, setUserPermissions] = useState({});
      const [isLoading, setIsLoading] = useState(false);
      const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
      const [cloneSourceUser, setCloneSourceUser] = useState('');

      const fetchModulesAndPermissions = useCallback(async () => {
        setIsLoading(true);
        try {
          const { data: dbModules, error: modulesError } = await supabase
            .from('modules')
            .select('id, name, description')
            .order('name', { ascending: true });
          if (modulesError) throw modulesError;

          setModules(dbModules || []);

          if (selectedUser) {
            const { data: permissionsData, error: permissionsError } = await supabase
              .from('user_modules')
              .select('module_id, allowed')
              .eq('user_id', selectedUser);
            if (permissionsError) throw permissionsError;
            
            const existingModuleIds = new Set((dbModules || []).map(m => m.id));
            const permissionsMap = permissionsData.reduce((acc, perm) => {
              if (existingModuleIds.has(perm.module_id)) {
                acc[perm.module_id] = perm.allowed;
              }
              return acc;
            }, {});
            setUserPermissions(permissionsMap);
          } else {
            setUserPermissions({});
          }
        } catch (error) {
          toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        } finally {
          setIsLoading(false);
        }
      }, [selectedUser, toast]);

      useEffect(() => {
        fetchModulesAndPermissions();
      }, [fetchModulesAndPermissions]);

      const handlePermissionChange = (moduleId, isChecked) => {
        setUserPermissions(prev => ({
          ...prev,
          [moduleId]: isChecked,
        }));
      };

      const handleSelectAll = (isChecked) => {
        const newPermissions = {};
        modules.forEach(module => {
          newPermissions[module.id] = isChecked;
        });
        setUserPermissions(newPermissions);
      };

      const handleSavePermissions = async () => {
        if (!selectedUser) {
          toast({ title: 'Selecione um usuário', variant: 'destructive' });
          return;
        }
        setIsLoading(true);
        try {
          const { data: validModuleIds, error: validModulesError } = await supabase
            .from('modules')
            .select('id');
            
          if (validModulesError) throw validModulesError;

          const validModuleIdSet = new Set(validModuleIds.map(m => m.id));

          const upsertData = modules
            .filter(module => validModuleIdSet.has(module.id))
            .map(module => ({
              user_id: selectedUser,
              module_id: module.id,
              allowed: !!userPermissions[module.id],
            }));
          
          if (upsertData.length > 0) {
            const { error } = await supabase.from('user_modules').upsert(upsertData, { onConflict: 'user_id, module_id' });
            if (error) throw error;
          }

          toast({ title: 'Permissões salvas com sucesso!', variant: 'success' });
          if (onDataUpdate) onDataUpdate();
        } catch (error) {
          toast({ title: 'Erro ao salvar permissões', description: error.message, variant: 'destructive' });
        } finally {
          setIsLoading(false);
        }
      };

      const handleClonePermissions = async () => {
        if (!cloneSourceUser) {
          toast({ title: 'Selecione um usuário para clonar', variant: 'destructive' });
          return;
        }
        setIsLoading(true);
        try {
          const { data: sourcePermissions, error } = await supabase
            .from('user_modules')
            .select('module_id, allowed')
            .eq('user_id', cloneSourceUser);
          if (error) throw error;
          
          const existingModuleIds = new Set(modules.map(m => m.id));
          const newPermissions = sourcePermissions.reduce((acc, perm) => {
             if (existingModuleIds.has(perm.module_id)) {
                acc[perm.module_id] = perm.allowed;
            }
            return acc;
          }, {});
          setUserPermissions(newPermissions);
          toast({ title: 'Permissões clonadas!', description: 'Revise e salve as alterações.' });
        } catch (error) {
          toast({ title: 'Erro ao clonar permissões', description: error.message, variant: 'destructive' });
        } finally {
          setIsLoading(false);
          setIsCloneDialogOpen(false);
        }
      };

      const allSelected = modules.length > 0 && modules.every(module => userPermissions[module.id]);

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-4 sm:p-6 bg-card rounded-xl shadow-sm border border-border space-y-6"
        >
          <h2 className="text-2xl font-bold text-card-foreground">Gerenciar Permissões</h2>
          
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg">
             <Info className="h-5 w-5" />
             <p className="text-sm font-medium">Somente módulos ativos são exibidos nesta lista.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label htmlFor="user-select" className="block text-sm font-medium text-muted-foreground mb-1">Usuário</label>
              <select
                id="user-select"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="custom-select"
                disabled={isLoading}
              >
                <option value="">Selecione um usuário</option>
                {users.map(user => (
                  <option 
                    key={user.id} 
                    value={user.id} 
                  >
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!selectedUser || isLoading}>
                  <Copy className="w-4 h-4 mr-2" /> Clonar Permissões
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clonar Permissões</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-muted-foreground">Selecione um usuário para copiar as permissões para <span className="font-bold text-foreground">{users.find(u => u.id === parseInt(selectedUser))?.name}</span>.</p>
                  <div>
                    <label htmlFor="clone-source-select" className="block text-sm font-medium text-muted-foreground mb-1">Copiar de:</label>
                    <select
                      id="clone-source-select"
                      value={cloneSourceUser}
                      onChange={(e) => setCloneSourceUser(e.target.value)}
                      className="custom-select"
                    >
                      <option value="">Selecione um usuário de origem</option>
                      {users.filter(u => u.id !== parseInt(selectedUser)).map(user => (
                        <option 
                          key={user.id} 
                          value={user.id}
                        >
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setIsCloneDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleClonePermissions} disabled={!cloneSourceUser}>
                    <Copy className="w-4 h-4 mr-2" /> Clonar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border-t pt-6 border-border">
            <div className="font-semibold grid grid-cols-3 gap-4 px-4 pb-2 border-b border-border text-card-foreground">
              <h3>Módulo</h3>
              <h3>Descrição</h3>
              <div className="flex justify-end items-center gap-2">
                <label htmlFor="select-all" className="text-sm font-medium">Selecionar Todos</label>
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  disabled={!selectedUser || isLoading}
                  aria-label="Selecionar todos os módulos"
                />
              </div>
            </div>
            <div className="max-h-[30rem] overflow-y-auto">
              {isLoading && !selectedUser && <p className="text-center p-4 text-muted-foreground">Selecione um usuário para ver as permissões.</p>}
              {isLoading && selectedUser && <p className="text-center p-4 text-muted-foreground">Carregando...</p>}
              {!isLoading && selectedUser && modules.map((module, index) => (
                <div
                  key={module.id}
                  className={`grid grid-cols-3 gap-4 items-center px-4 py-3 ${index % 2 === 0 ? 'bg-background' : 'bg-card'}`}
                >
                  <span className="font-medium text-foreground">{module.name}</span>
                  <span className="text-sm text-muted-foreground">{module.description || 'Sem descrição'}</span>
                  <div className="flex justify-end">
                    <Checkbox
                      id={`perm-${module.id}`}
                      checked={!!userPermissions[module.id]}
                      onCheckedChange={(checked) => handlePermissionChange(module.id, checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSavePermissions} disabled={!selectedUser || isLoading}>
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? 'Salvando...' : 'Salvar Permissões'}
            </Button>
          </div>
        </motion.div>
      );
    };

    export default PermissoesTab;