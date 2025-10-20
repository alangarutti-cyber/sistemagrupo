import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Trash2, Edit, Save, X, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Label } from '@/components/ui/label';
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

    const DreGroupItem = ({ group, level = 0, onUpdate, onDelete, allGroups }) => {
      const { toast } = useToast();
      const [isEditing, setIsEditing] = useState(false);
      const [editedName, setEditedName] = useState(group.name);
      const [editedType, setEditedType] = useState(group.type);
      const [isCalculated, setIsCalculated] = useState(group.is_calculated);
      const [parentId, setParentId] = useState(group.parent_id);
      const [isOpen, setIsOpen] = useState(true);

      const handleSave = async () => {
        const { error } = await supabase
          .from('dre_groups')
          .update({
            name: editedName,
            type: editedType,
            is_calculated: isCalculated,
            parent_id: parentId,
          })
          .eq('id', group.id);

        if (error) {
          toast({ title: 'Erro ao atualizar grupo', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Grupo atualizado com sucesso!', variant: 'success' });
          setIsEditing(false);
          onUpdate();
        }
      };

      const handleAddChild = async () => {
        const { data, error } = await supabase
          .from('dre_groups')
          .insert({
            name: "Novo Subgrupo",
            type: group.type,
            parent_id: group.id
          })
          .select()
          .single();

        if(error) {
            toast({ title: 'Erro ao adicionar subgrupo', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Subgrupo adicionado', variant: 'success' });
            onUpdate();
        }
      };
      
      const filteredGroups = allGroups.filter(g => g.id !== group.id && !group.children?.some(c => c.id === g.id));

      return (
        <div className="w-full">
          <div
            className="flex items-center gap-2 p-2 rounded-lg bg-card border hover:bg-muted"
            style={{ marginLeft: `${level * 20}px` }}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />

            {group.children && group.children.length > 0 && (
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className="h-6 w-6">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            )}

            {!isEditing ? (
              <>
                <span className="flex-1 font-medium">{group.name}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${group.type === 'receita' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {group.type}
                </span>
                {group.is_calculated && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                    Calculado
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={handleAddChild} className="h-8 w-8"><Plus className="h-4 w-4 text-green-600"/></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita e irá excluir o grupo e todos os seus subgrupos.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(group.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row gap-2 items-start md:items-center">
                <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="h-8 flex-grow" />
                <select value={editedType} onChange={(e) => setEditedType(e.target.value)} className="h-8 border rounded-md px-2 text-sm bg-background">
                  <option value="receita">Receita</option>
                  <option value="custo">Custo</option>
                  <option value="despesa">Despesa</option>
                </select>
                <select value={parentId || ''} onChange={(e) => setParentId(e.target.value || null)} className="h-8 border rounded-md px-2 text-sm bg-background">
                    <option value="">Grupo Principal</option>
                    {filteredGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
                <div className="flex items-center space-x-2">
                    <Checkbox id={`calc-${group.id}`} checked={isCalculated} onCheckedChange={setIsCalculated} />
                    <Label htmlFor={`calc-${group.id}`} className="text-sm">É calculado?</Label>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" onClick={handleSave} className="h-8 w-8"><Save className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>
          {isOpen && group.children && (
            <div className="mt-1 space-y-1">
              {group.children.map(child => (
                <DreGroupItem key={child.id} group={child} level={level + 1} onUpdate={onUpdate} onDelete={onDelete} allGroups={allGroups} />
              ))}
            </div>
          )}
        </div>
      );
    };

    const DreGroupsTab = () => {
      const { toast } = useToast();
      const [groups, setGroups] = useState([]);
      const [loading, setLoading] = useState(true);

      const fetchGroups = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('dre_groups').select('*').order('id');
        if (error) {
          toast({ title: 'Erro ao buscar grupos', description: error.message, variant: 'destructive' });
        } else {
            const groupMap = {};
            const groupTree = [];

            data.forEach(group => {
                groupMap[group.id] = { ...group, children: [] };
            });

            data.forEach(group => {
                if (group.parent_id && groupMap[group.parent_id]) {
                    groupMap[group.parent_id].children.push(groupMap[group.id]);
                } else {
                    groupTree.push(groupMap[group.id]);
                }
            });
            setGroups(groupTree);
        }
        setLoading(false);
      }, [toast]);

      useEffect(() => {
        fetchGroups();
      }, [fetchGroups]);
      
      const getAllGroupsAsFlatList = (groupList) => {
        let flatList = [];
        function traverse(groups) {
          groups.forEach(group => {
            const { children, ...rest } = group;
            flatList.push(rest);
            if(children && children.length > 0) {
              traverse(children);
            }
          });
        }
        traverse(groupList);
        return flatList;
      }

      const handleAddGroup = async () => {
        const { data, error } = await supabase
          .from('dre_groups')
          .insert({ name: 'Novo Grupo', type: 'receita' })
          .select()
          .single();
        if (error) {
          toast({ title: 'Erro ao adicionar grupo', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Grupo adicionado com sucesso!', variant: 'success' });
          fetchGroups();
        }
      };

      const handleDeleteGroup = async (groupId) => {
        const { error } = await supabase.from('dre_groups').delete().eq('id', groupId);
        if (error) {
          toast({ title: 'Erro ao excluir grupo', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Grupo excluído com sucesso!', variant: 'success' });
          fetchGroups();
        }
      };

      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Estrutura do DRE</h2>
            <Button onClick={handleAddGroup}>
              <Plus className="mr-2 h-4 w-4" /> Novo Grupo Principal
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Arraste e solte para reordenar. Crie e edite os grupos e subgrupos que formarão seu Demonstrativo de Resultados.
          </p>

          {loading ? (
            <p>Carregando estrutura...</p>
          ) : (
            <div className="space-y-2 p-2 rounded-lg bg-background">
              {groups.map(group => (
                <DreGroupItem key={group.id} group={group} onUpdate={fetchGroups} onDelete={handleDeleteGroup} allGroups={getAllGroupsAsFlatList(groups)} />
              ))}
              {groups.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum grupo DRE criado.</p>}
            </div>
          )}
        </motion.div>
      );
    };

    export default DreGroupsTab;