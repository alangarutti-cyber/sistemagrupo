import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle, XCircle, AlertTriangle, MoreHorizontal, Edit, Trash2, Save, X, Camera, FileDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useUser } from '@/contexts/UserContext';

const statusConfig = {
  'Conforme': { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100' },
  'Não Conforme': { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100' },
  'Pendente': { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-100' },
};

const priorityConfig = {
  'Alta': 'bg-red-500',
  'Média': 'bg-yellow-500',
  'Baixa': 'bg-green-500',
};

const ChecklistItem = ({ item, onUpdate }) => {
  const StatusIcon = statusConfig[item.status]?.icon || AlertTriangle;
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ status: item.status, observation: item.observation || '' });

  const handleSave = () => {
    onUpdate(item.id, editData);
    setIsEditing(false);
  };

  return (
    <div className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <p className="font-medium flex-1 pr-4">{item.item_description}</p>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-semibold text-white rounded-full ${priorityConfig[item.priority]}`}>
            {item.priority}
          </span>
          <StatusIcon className={`w-5 h-5 ${statusConfig[item.status]?.color}`} />
        </div>
      </div>
      {isEditing ? (
        <div className="mt-4 space-y-4">
          <div>
            <Label>Status</Label>
            <select
              value={editData.status}
              onChange={(e) => setEditData({ ...editData, status: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background"
            >
              {Object.keys(statusConfig).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea
              value={editData.observation}
              onChange={(e) => setEditData({ ...editData, observation: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          {item.observation && <p className="text-sm text-muted-foreground">Obs: {item.observation}</p>}
          <div className="flex justify-end items-center gap-2 mt-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => alert("Função de upload de foto em breve!")}>
              <Camera className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Editar</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const Checklists = () => {
  const { user, companies, userCompanyAccess } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [checklistItems, setChecklistItems] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSector, setSelectedSector] = useState('Todos');

  const userCompanies = useMemo(() => {
    if (!user) return [];
    if (user.is_admin) return companies;
    const allowedCompanyIds = userCompanyAccess.filter(access => access.user_id === user.id).map(c => c.company_id);
    return companies.filter(c => allowedCompanyIds.includes(c.id));
  }, [user, companies, userCompanyAccess]);

  useEffect(() => {
    if (userCompanies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].id);
    }
  }, [userCompanies, selectedCompanyId]);

  const fetchChecklistData = useCallback(async () => {
    if (!selectedCompanyId || !selectedDate || !user) return;
    setLoading(true);

    // 1. Get or create runs for the selected date and company
    const { data: templates, error: templatesError } = await supabase
      .from('checklist_templates')
      .select('id, sector')
      .eq('company_id', selectedCompanyId)
      .eq('is_active', true);

    if (templatesError) {
      toast({ title: "Erro ao buscar modelos", description: templatesError.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    
    const uniqueSectors = [...new Set(templates.map(t => t.sector))];
    setSectors(['Todos', ...uniqueSectors]);

    const runsPromises = templates.map(async (template) => {
      let { data: run } = await supabase
        .from('checklist_runs')
        .select('id')
        .eq('template_id', template.id)
        .eq('run_date', selectedDate)
        .single();

      if (!run) {
        const { data: newRun, error: newRunError } = await supabase
          .from('checklist_runs')
          .insert({
            template_id: template.id,
            company_id: selectedCompanyId,
            sector: template.sector,
            run_date: selectedDate,
            status: 'Pendente',
            responsible_id: user.id,
          }).select('id').single();
        
        if (newRunError) throw newRunError;
        run = newRun;

        const { data: templateItems } = await supabase
          .from('checklist_template_items')
          .select('id')
          .eq('template_id', template.id);

        if(templateItems && templateItems.length > 0) {
            const runItemsToInsert = templateItems.map(ti => ({
              run_id: run.id,
              template_item_id: ti.id,
              status: 'Pendente',
            }));
            if (runItemsToInsert.length > 0) {
              await supabase.from('checklist_run_items').insert(runItemsToInsert);
            }
        }
      }
      return run.id;
    });

    const runIds = (await Promise.all(runsPromises)).filter(Boolean);

    // 2. Fetch all items for today's runs
    if (runIds.length === 0) {
      setChecklistItems([]);
      setLoading(false);
      return;
    }

    const { data: runItems, error: runItemsError } = await supabase
      .from('checklist_run_items')
      .select(`
        id,
        status,
        observation,
        photo_url,
        run:checklist_runs(sector),
        template_item:checklist_template_items(description, priority, frequency)
      `)
      .in('run_id', runIds);

    if (runItemsError) {
      toast({ title: "Erro ao buscar itens do checklist", description: runItemsError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const formattedItems = runItems.map(item => ({
      id: item.id,
      sector: item.run.sector,
      item_description: item.template_item.description,
      priority: item.template_item.priority,
      frequency: item.template_item.frequency,
      status: item.status,
      observation: item.observation,
      photo_url: item.photo_url,
    }));

    setChecklistItems(formattedItems);
    setLoading(false);
  }, [selectedCompanyId, selectedDate, user, toast]);

  useEffect(() => {
    fetchChecklistData();
  }, [fetchChecklistData]);

  const handleUpdateItem = async (itemId, updatedData) => {
    const { error } = await supabase
      .from('checklist_run_items')
      .update({ status: updatedData.status, observation: updatedData.observation })
      .eq('id', itemId);

    if (error) {
      toast({ title: "Erro ao atualizar item", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Item atualizado!", variant: "success" });
      fetchChecklistData();
    }
  };
  
  const generatePDF = () => {
    const doc = new jsPDF();
    const companyName = userCompanies.find(c => c.id === selectedCompanyId)?.name || 'Empresa';
    
    doc.setFontSize(18);
    doc.text(`Relatório de Checklist - ${companyName}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Data: ${new Date(selectedDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`, 14, 30);

    const tableColumn = ["Setor", "Item", "Prioridade", "Status", "Observação"];
    const tableRows = [];

    filteredItems.forEach(item => {
      const itemData = [
        item.sector,
        item.item_description,
        item.priority,
        item.status,
        item.observation || ''
      ];
      tableRows.push(itemData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
    });
    
    doc.save(`checklist_${companyName}_${selectedDate}.pdf`);
    toast({ title: "PDF gerado com sucesso!" });
  };

  const filteredItems = useMemo(() => {
    if (selectedSector === 'Todos') return checklistItems;
    return checklistItems.filter(item => item.sector === selectedSector);
  }, [checklistItems, selectedSector]);

  if (!user) {
    return <p className="text-center py-10">Carregando dados do usuário...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Checklist Operacional</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button onClick={generatePDF}>
            <FileDown className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/4">
          <Label>Empresa</Label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background"
          >
            {userCompanies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </div>
        <div className="w-full md:w-3/4">
          <Label>Setor</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {sectors.map(sector => (
              <Button
                key={sector}
                variant={selectedSector === sector ? 'default' : 'outline'}
                onClick={() => setSelectedSector(sector)}
              >
                {sector}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-10">Carregando checklists...</p>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl">
          <h3 className="text-xl font-semibold">Nenhum item de checklist para hoje</h3>
          <p className="text-muted-foreground mt-2">Verifique os modelos de checklist ou a data selecionada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(item => (
            <ChecklistItem key={item.id} item={item} onUpdate={handleUpdateItem} />
          ))}
        </div>
      )}
       <div className="flex justify-end mt-6">
        <Button size="lg" onClick={() => toast({title: "Dia finalizado!", description:"Resumo enviado para o dashboard."})}>
          Finalizar Dia
        </Button>
      </div>
    </div>
  );
};

export default Checklists;