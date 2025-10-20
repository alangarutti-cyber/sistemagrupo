import React, { useState } from 'react';
import { Save, X, Edit, Check, Trash2 } from 'lucide-react';
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

const EmpresasTab = ({ companies: initialCompanies, onCompanyUpdate }) => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState(initialCompanies || []);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [companyData, setCompanyData] = useState({});
  const availableSectors = ['Delivery', 'Salão', 'Cozinha', 'Produção'];

  const handleEditCompany = (company) => {
    setEditingCompanyId(company.id);
    setCompanyData({ ...company });
  };

  const handleCancelEditCompany = () => {
    setEditingCompanyId(null);
    setCompanyData({});
  };

  const handleSaveCompany = async () => {
    const { id, created_at, ...updateData } = companyData;
    const { data, error } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao salvar empresa', description: error.message, variant: 'destructive' });
    } else {
      onCompanyUpdate();
      toast({ title: 'Empresa atualizada com sucesso!', variant: 'success' });
      handleCancelEditCompany();
    }
  };

  const handleCompanyInputChange = (field, value) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleCompanySectorChange = (sector, isChecked) => {
    const currentSectors = Array.isArray(companyData.sectors) ? companyData.sectors : [];
    const updatedSectors = isChecked
      ? [...currentSectors, sector]
      : currentSectors.filter(s => s !== sector);
    setCompanyData(prev => ({ ...prev, sectors: updatedSectors }));
  };

  const handleDeleteCompany = async (companyId) => {
    const { error } = await supabase.from('companies').delete().eq('id', companyId);

    if (error) {
      toast({ title: 'Erro ao excluir empresa', description: 'Verifique se a empresa não está vinculada a outros cadastros.', variant: 'destructive' });
    } else {
      onCompanyUpdate();
      toast({ title: 'Empresa excluída com sucesso!', variant: 'success' });
    }
  };

  return (
    <div className="space-y-6">
      {companies.map(company => (
        <div key={company.id} className="p-4 sm:p-6 bg-card rounded-xl shadow-sm border border-border">
          {editingCompanyId === company.id ? (
            <div className="space-y-4">
              <input type="text" value={companyData.name} onChange={e => handleCompanyInputChange('name', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border text-xl font-bold" placeholder="Nome da Empresa" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" value={companyData.cnpj} onChange={e => handleCompanyInputChange('cnpj', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" placeholder="CNPJ" />
                <input type="text" value={companyData.phone} onChange={e => handleCompanyInputChange('phone', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" placeholder="Telefone" />
              </div>
              <input type="text" value={companyData.address} onChange={e => handleCompanyInputChange('address', e.target.value)} className="w-full p-2 border rounded bg-card text-foreground border-border" placeholder="Endereço Completo" />
              
              <div className="mt-4">
                <p className="font-semibold text-muted-foreground mb-2">Setores:</p>
                <div className="flex flex-wrap gap-4">
                  {availableSectors.map(sector => (
                    <label key={sector} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="h-5 w-5 rounded" checked={(companyData.sectors || []).includes(sector)} onChange={e => handleCompanySectorChange(sector, e.target.checked)} />
                      <span>{sector}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button onClick={handleSaveCompany} size="sm"><Check className="w-4 h-4 mr-2" /> Salvar</Button>
                <Button onClick={handleCancelEditCompany} variant="ghost" size="sm"><X className="w-4 h-4 mr-2" /> Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-card-foreground">{company.name}</h3>
                <p className="text-sm text-muted-foreground">CNPJ: {company.cnpj}</p>
                <p className="text-sm text-muted-foreground">Telefone: {company.phone || 'Não informado'}</p>
                <p className="text-sm text-muted-foreground">Endereço: {company.address || 'Não informado'}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(company.sectors || []).map(sector => (
                    <span key={sector} className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">{sector}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 sm:mt-0">
                <Button onClick={() => handleEditCompany(company)} variant="outline" size="icon"><Edit className="w-4 h-4" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon"><Trash2 className="w-4 h-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente a empresa e todos os dados associados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteCompany(company.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default EmpresasTab;