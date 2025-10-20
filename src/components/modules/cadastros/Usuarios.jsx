import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Save, X, Edit, Check, UserCog, PlusCircle, Trash2, Building, RefreshCw, SlidersHorizontal, Loader2, KeyRound, MonitorSmartphone } from 'lucide-react';
    import { Button } from '@/components/ui/button';
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
      AlertDialogTrigger,
    } from "@/components/ui/alert-dialog";
    import {
      Dialog,
      DialogContent,
      DialogHeader,
      DialogTitle,
      DialogDescription,
      DialogFooter,
    } from "@/components/ui/dialog";
    import { Checkbox } from '@/components/ui/checkbox';
    import { Label } from '@/components/ui/label';

    const ManageModulesModal = ({ user, allModules, isOpen, onClose, onSave }) => {
        const { toast } = useToast();
        const [userModules, setUserModules] = useState([]);
        const [loading, setLoading] = useState(true);
        const [saving, setSaving] = useState(false);

        useEffect(() => {
            const fetchUserModules = async () => {
                if (!user) return;
                setLoading(true);
                const { data, error } = await supabase
                    .from('user_modules')
                    .select('module_id, allowed')
                    .eq('user_id', user.id);

                if (error) {
                    toast({ title: 'Erro ao buscar módulos do usuário', variant: 'destructive' });
                } else {
                    const userModuleMap = new Map(data.map(um => [um.module_id, um.allowed]));
                    const modulesWithPermissions = allModules.map(m => ({
                        ...m,
                        allowed: userModuleMap.has(m.id) ? userModuleMap.get(m.id) : true, // Default to true if not set
                    }));
                    setUserModules(modulesWithPermissions);
                }
                setLoading(false);
            };

            if (isOpen) {
                fetchUserModules();
            }
        }, [user, allModules, isOpen, toast]);

        const handleToggle = (moduleId) => {
            setUserModules(prev => prev.map(m => m.id === moduleId ? { ...m, allowed: !m.allowed } : m));
        };

        const handleSelectAll = (shouldSelect) => {
            setUserModules(prev => prev.map(m => ({ ...m, allowed: shouldSelect })));
        };

        const handleSaveChanges = async () => {
            setSaving(true);
            const upsertData = userModules.map(m => ({
                user_id: user.id,
                module_id: m.id,
                allowed: m.allowed,
            }));

            const { error } = await supabase.from('user_modules').upsert(upsertData, { onConflict: 'user_id, module_id' });

            if (error) {
                toast({ title: 'Erro ao salvar permissões', description: error.message, variant: 'destructive' });
            } else {
                toast({ title: 'Permissões atualizadas com sucesso!', variant: 'success' });
                onSave();
                onClose();
            }
            setSaving(false);
        };

        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Gerenciar Módulos para {user?.name}</DialogTitle>
                        <DialogDescription>
                            Selecione os módulos que este usuário pode acessar.
                        </DialogDescription>
                    </DialogHeader>
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-end gap-2 my-2">
                                <Button variant="outline" size="sm" onClick={() => handleSelectAll(true)}>Marcar Todos</Button>
                                <Button variant="outline" size="sm" onClick={() => handleSelectAll(false)}>Desmarcar Todos</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 max-h-80 overflow-y-auto p-1">
                                {userModules.map(module => (
                                    <div key={module.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`module-access-${module.id}`}
                                            checked={module.allowed}
                                            onCheckedChange={() => handleToggle(module.id)}
                                        />
                                        <Label htmlFor={`module-access-${module.id}`}>{module.name}</Label>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                        <Button onClick={handleSaveChanges} disabled={saving || loading}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    const UsuariosTab = ({ companies, users: initialUsers, onDataUpdate }) => {
      const { toast } = useToast();
      const [users, setUsers] = useState([]);
      
      const [editingUserDetailsId, setEditingUserDetailsId] = useState(null);
      const [userData, setUserData] = useState({});
      const [userCompanies, setUserCompanies] = useState([]);

      const [isAddingUser, setIsAddingUser] = useState(false);
      const initialNewUserData = {
        name: '', email: '', phone: '', password: '', role: 'Caixa',
        company_ids: [],
        can_access_pdv: true,
        pdv_pin: ''
      };
      const [newUserData, setNewUserData] = useState(initialNewUserData);
      const [isSyncing, setIsSyncing] = useState(false);

      const [isModulesModalOpen, setIsModulesModalOpen] = useState(false);
      const [selectedUserForModules, setSelectedUserForModules] = useState(null);
      const [allModules, setAllModules] = useState([]);

      const roles = ['Administrador', 'Super Administrador', 'Gerente', 'Caixa'];

      useEffect(() => {
        if (initialUsers) {
          const usersWithCompanies = initialUsers.map(user => {
            const companyIds = (user.company_ids || []).map(c => c.company_id);
            return { ...user, company_ids: companyIds };
          });
          setUsers(usersWithCompanies);
        }
      }, [initialUsers]);

      useEffect(() => {
        const fetchModules = async () => {
            const { data, error } = await supabase.from('modules').select('id, name');
            if (error) {
                toast({ title: 'Erro ao buscar módulos', variant: 'destructive' });
            } else {
                setAllModules(data);
            }
        };
        fetchModules();
      }, [toast]);

      const handleSyncUsers = async () => {
        setIsSyncing(true);
        toast({ title: 'Sincronizando usuários...', description: 'Buscando por novos usuários na autenticação.' });

        try {
          const { data, error } = await supabase.functions.invoke('sync-auth-users');

          if (error) {
            throw new Error(error.message);
          }

          if (data.error) {
            throw new Error(data.error);
          }
          
          toast({ title: 'Sincronização completa!', description: data.message });
          if (onDataUpdate) onDataUpdate();

        } catch (error) {
          toast({ title: 'Erro na sincronização', description: error.message, variant: 'destructive' });
        } finally {
          setIsSyncing(false);
        }
      };

      const handleRoleChange = (role, isNewUser = false) => {
        const stateSetter = isNewUser ? setNewUserData : setUserData;
        stateSetter(prev => ({ ...prev, role }));
        if (isNewUser) {
            setNewUserData(prev => ({...prev, company_ids: []}));
        } else {
          setUserCompanies([]);
        }
      };

      const handleEditUser = (u) => {
        setEditingUserDetailsId(u.id);
        setUserData({ ...u });
        setUserCompanies(u.company_ids || []);
      };

      const handleCancelEditUser = () => {
        setEditingUserDetailsId(null);
        setUserData({});
        setUserCompanies([]);
      };

      const handleUserInputChange = (field, value) => {
        if (field === 'pdv_pin') {
          const numericValue = value.replace(/[^0-9]/g, '');
          setUserData(prev => ({ ...prev, [field]: numericValue }));
        } else {
          setUserData(prev => ({ ...prev, [field]: value }));
        }
      };
      
      const handleUserCheckboxChange = (field, checked) => {
        setUserData(prev => ({ ...prev, [field]: checked }));
      };

      const handleSaveUser = async () => {
        const { id, uuid, created_at, permissions, is_admin, password, company_sector_permissions, company_ids, ...updateData } = userData;
        
        if (updateData.role === 'Caixa' && userCompanies.length > 1) {
          toast({ title: 'Regra de Negócio', description: 'Usuários do tipo "Caixa" podem pertencer a apenas uma empresa.', variant: 'destructive' });
          return;
        }

        if (updateData.can_access_pdv && (!updateData.pdv_pin || updateData.pdv_pin.length !== 4)) {
          toast({ title: 'PIN Inválido', description: 'O PIN do PDV deve ter 4 dígitos numéricos.', variant: 'destructive' });
          return;
        }
        
        const { error } = await supabase
          .from('app_users')
          .update({ ...updateData, is_admin: updateData.role === 'Administrador' || updateData.role === 'Super Administrador' })
          .eq('id', id);

        if (error) {
          toast({ title: 'Erro ao salvar usuário', description: error.message, variant: 'destructive' });
          return;
        }
        
        await supabase.from('user_company_access').delete().eq('user_id', id);
        const accessData = userCompanies.map(company_id => ({ user_id: id, company_id }));
        if (accessData.length > 0) {
          await supabase.from('user_company_access').insert(accessData);
        }

        toast({ title: 'Usuário atualizado com sucesso!', variant: 'success' });
        if (onDataUpdate) onDataUpdate();
        handleCancelEditUser();
      };

      const handleNewUserInputChange = (field, value) => {
        if (field === 'pdv_pin') {
            const numericValue = value.replace(/[^0-9]/g, '');
            setNewUserData(prev => ({ ...prev, [field]: numericValue }));
        } else {
            setNewUserData(prev => ({ ...prev, [field]: value }));
        }
      };
      
      const handleNewUserCheckboxChange = (field, checked) => {
        setNewUserData(prev => ({ ...prev, [field]: checked }));
      };

      const handleNewUserCompanyChange = (companyId, isChecked) => {
        setNewUserData(prev => {
          let newIds = prev.company_ids || [];
          if (prev.role === 'Caixa') {
            newIds = isChecked ? [companyId] : [];
          } else {
            newIds = isChecked ? [...newIds, companyId] : newIds.filter(id => id !== companyId);
          }
          return { ...prev, company_ids: newIds };
        });
      };

      const handleEditUserCompanyChange = (companyId, isChecked) => {
        setUserCompanies(prev => {
          let newIds = [...prev];
          if (userData.role === 'Caixa') {
            newIds = isChecked ? [companyId] : [];
          } else {
            newIds = isChecked ? [...newIds, companyId] : newIds.filter(id => id !== companyId);
          }
          return newIds;
        });
      };

      const handleCancelAddUser = () => {
        setIsAddingUser(false);
        setNewUserData(initialNewUserData);
      };

      const handleCreateUser = async () => {
        if (!newUserData.name || !newUserData.email || !newUserData.password) {
          toast({ title: 'Campos obrigatórios', description: 'Nome, email e senha são obrigatórios.', variant: 'destructive' });
          return;
        }
        if (newUserData.role === 'Caixa' && newUserData.company_ids.length !== 1) {
          toast({ title: 'Regra de Negócio', description: 'Usuários do tipo "Caixa" devem pertencer a exatamente uma empresa.', variant: 'destructive' });
          return;
        }

        if (newUserData.can_access_pdv && (!newUserData.pdv_pin || newUserData.pdv_pin.length !== 4)) {
          toast({ title: 'PIN Inválido', description: 'O PIN do PDV deve ter 4 dígitos numéricos.', variant: 'destructive' });
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({ email: newUserData.email, password: newUserData.password });
        if (authError) {
          toast({ title: 'Erro ao criar autenticação', description: authError.message, variant: 'destructive' });
          return;
        }

        if (authData.user) {
          const { password, company_ids, ...restOfNewUserData } = newUserData;
          const { data: appUserData, error: appUserError } = await supabase
            .from('app_users')
            .insert({
              uuid: authData.user.id,
              name: restOfNewUserData.name,
              email: restOfNewUserData.email,
              phone: restOfNewUserData.phone,
              username: restOfNewUserData.email,
              password: 'encrypted',
              is_admin: restOfNewUserData.role === 'Administrador' || restOfNewUserData.role === 'Super Administrador',
              role: restOfNewUserData.role,
              can_access_pdv: restOfNewUserData.can_access_pdv,
              pdv_pin: restOfNewUserData.pdv_pin,
            })
            .select()
            .single();

          if (appUserError) {
            toast({ title: 'Erro ao salvar dados do usuário', description: appUserError.message, variant: 'destructive' });
            return;
          }

          if (company_ids && company_ids.length > 0) {
            const accessData = company_ids.map(company_id => ({ user_id: appUserData.id, company_id }));
            const { error: accessError } = await supabase.from('user_company_access').insert(accessData);
            if (accessError) {
              toast({ title: 'Erro ao associar empresas', description: accessError.message, variant: 'destructive' });
            }
          }

          toast({ title: 'Usuário criado com sucesso!', variant: 'success' });
          if (onDataUpdate) onDataUpdate();
          handleCancelAddUser();
        }
      };

      const handleDeleteUser = async (userToDelete) => {
        const { error: dbError } = await supabase.from('app_users').delete().eq('id', userToDelete.id);
        if (dbError) {
          toast({ title: 'Erro ao excluir usuário do banco', description: dbError.message, variant: 'destructive' });
          return;
        }

        const { error: functionError } = await supabase.functions.invoke('delete-user', { body: JSON.stringify({ userId: userToDelete.uuid }) });
        if (functionError) {
          toast({ title: 'Erro ao excluir autenticação do usuário', description: functionError.message, variant: 'destructive' });
        }

        toast({ title: 'Usuário excluído com sucesso!', variant: 'success' });
        if (onDataUpdate) onDataUpdate();
      };

      const openModulesModal = (user) => {
        setSelectedUserForModules(user);
        setIsModulesModalOpen(true);
      };

      const renderAddUserForm = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6 bg-card rounded-xl shadow-sm border border-border space-y-6">
          <h3 className="text-xl font-bold text-card-foreground">Adicionar Novo Usuário</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Nome Completo" value={newUserData.name} onChange={e => handleNewUserInputChange('name', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" />
            <input type="email" placeholder="Email" value={newUserData.email} onChange={e => handleNewUserInputChange('email', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" />
            <input type="text" placeholder="Telefone (Opcional)" value={newUserData.phone} onChange={e => handleNewUserInputChange('phone', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" />
            <input type="password" placeholder="Senha" value={newUserData.password} onChange={e => handleNewUserInputChange('password', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" />
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Função</label>
              <select value={newUserData.role} onChange={e => handleRoleChange(e.target.value, true)} className="custom-select">
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="flex items-center space-x-2">
                <Checkbox id="pdv-access-new" checked={newUserData.can_access_pdv} onCheckedChange={(checked) => handleNewUserCheckboxChange('can_access_pdv', checked)} />
                <Label htmlFor="pdv-access-new">Acesso ao PDV</Label>
            </div>
            {newUserData.can_access_pdv && (
                <input type="text" placeholder="PIN do PDV (4 dígitos)" value={newUserData.pdv_pin} onChange={e => handleNewUserInputChange('pdv_pin', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" maxLength={4} />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Acesso à(s) Empresa(s)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {companies.map(c => (
                <label key={c.id} className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-secondary">
                  <input 
                    type={newUserData.role === 'Caixa' ? 'radio' : 'checkbox'} 
                    name="company-access"
                    className="h-4 w-4" 
                    checked={(newUserData.company_ids || []).includes(c.id)} 
                    onChange={e => handleNewUserCompanyChange(c.id, e.target.checked)} 
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button onClick={handleCreateUser}><Save className="w-4 h-4 mr-2" /> Criar Usuário</Button>
            <Button onClick={handleCancelAddUser} variant="ghost"><X className="w-4 h-4 mr-2" /> Cancelar</Button>
          </div>
        </motion.div>
      );

      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button onClick={handleSyncUsers} variant="outline" disabled={isSyncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Usuários'}
            </Button>
            <Button onClick={() => setIsAddingUser(true)}><PlusCircle className="w-4 h-4 mr-2" /> Adicionar Usuário</Button>
          </div>

          {isAddingUser && renderAddUserForm()}

          {users.map(u => {
            const userCompaniesNames = (u.company_ids || []).map(id => (companies || []).find(c => c.id === id)?.name).filter(Boolean);
            return (
              <div key={u.id} className="p-4 sm:p-6 bg-card rounded-xl shadow-sm border border-border">
                {editingUserDetailsId === u.id ? (
                  <div className="space-y-4">
                    <input type="text" value={userData.name} onChange={e => handleUserInputChange('name', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border text-xl font-bold" />
                    <input type="email" value={userData.email} onChange={e => handleUserInputChange('email', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" />
                    <input type="text" value={userData.phone || ''} onChange={e => handleUserInputChange('phone', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-1">Função</label>
                          <select value={userData.role} onChange={e => handleRoleChange(e.target.value, false)} className="custom-select">
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div className="flex items-center space-x-2">
                            <Checkbox id={`pdv-access-edit-${u.id}`} checked={userData.can_access_pdv} onCheckedChange={(checked) => handleUserCheckboxChange('can_access_pdv', checked)} />
                            <Label htmlFor={`pdv-access-edit-${u.id}`}>Acesso ao PDV</Label>
                        </div>
                        {userData.can_access_pdv && (
                            <input type="text" placeholder="PIN do PDV (4 dígitos)" value={userData.pdv_pin || ''} onChange={e => handleUserInputChange('pdv_pin', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" maxLength={4} />
                        )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Acesso à(s) Empresa(s)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {companies.map(c => (
                          <label key={c.id} className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-secondary">
                            <input 
                              type={userData.role === 'Caixa' ? 'radio' : 'checkbox'}
                              name={`company-access-edit-${u.id}`}
                              className="h-4 w-4" 
                              checked={userCompanies.includes(c.id)} 
                              onChange={e => handleEditUserCompanyChange(c.id, e.target.checked)} 
                            />
                            <span>{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                      <Button onClick={handleSaveUser} size="sm"><Check className="w-4 h-4 mr-2" /> Salvar</Button>
                      <Button onClick={handleCancelEditUser} variant="ghost" size="sm"><X className="w-4 h-4 mr-2" /> Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg sm:text-xl font-bold text-card-foreground">{u.name}</h3>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                        {userCompaniesNames.length > 0 && (
                          <div className="flex items-center flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                            <Building className="w-4 h-4 flex-shrink-0" />
                            <span>{userCompaniesNames.join(', ')}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full inline-block ${u.role === 'Administrador' ? 'bg-amber-100 text-amber-700' : u.role === 'Super Administrador' ? 'bg-purple-100 text-purple-700' : 'bg-muted text-muted-foreground'}`}>
                              {u.role || 'Usuário'}
                            </span>
                             {u.can_access_pdv && (
                                <span className="text-xs font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1 bg-green-100 text-green-700">
                                    <MonitorSmartphone className="w-3 h-3" /> PDV
                                </span>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4 sm:mt-0">
                        <Button onClick={() => openModulesModal(u)} variant="outline" size="icon" title="Gerenciar Módulos"><SlidersHorizontal className="w-4 h-4" /></Button>
                        <Button onClick={() => handleEditUser(u)} variant="outline" size="icon" title="Editar Usuário"><UserCog className="w-4 h-4" /></Button>
                        {!u.is_admin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" title="Excluir Usuário"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(u)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
          <ManageModulesModal 
            user={selectedUserForModules}
            allModules={allModules}
            isOpen={isModulesModalOpen}
            onClose={() => setIsModulesModalOpen(false)}
            onSave={onDataUpdate}
          />
        </div>
      );
    };

    export default UsuariosTab;