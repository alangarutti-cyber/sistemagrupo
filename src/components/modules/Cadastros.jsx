
import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { ChevronLeft } from 'lucide-react';
    import { useUser } from '@/contexts/UserContext';

    // Importa os componentes das abas de cadastro
    import ProdutosTab from '@/components/modules/cadastros/Produtos';
    import ProdutosV2Tab from '@/components/modules/cadastros/ProdutosV2'; // Novo Módulo
    import CategoriasProdutosTab from '@/components/modules/cadastros/CategoriasProdutos';
    import ClientesTab from '@/components/modules/cadastros/Clientes';
    import UsuariosTab from '@/components/modules/cadastros/Usuarios';
    import PermissoesTab from '@/components/modules/cadastros/Permissoes';
    import FormasPagamentoTab from '@/components/modules/cadastros/FormasPagamento';
    import OperadorasCartaoTab from '@/components/modules/cadastros/OperadorasCartao';
    import CertificadosTab from '@/components/modules/cadastros/Certificados';
    import DreGroupsTab from '@/components/modules/cadastros/DreGroups';
    import DreMappingsTab from '@/components/modules/cadastros/DreMappings';
    import ModulosSistema from '@/components/modules/cadastros/ModulosSistema';
    import UnidadesMedida from '@/components/modules/cadastros/UnidadesMedida';
    import EmpresasTab from '@/components/modules/cadastros/Empresas';
    import LocaisImpressao from '@/components/modules/cadastros/LocaisImpressao';
    import MaquinasCartao from '@/components/modules/MaquinasCartao';

    const Cadastros = () => {
      const context = useUser();
      const [activeSubModule, setActiveSubModule] = useState(null);

      const subModules = [
        { value: "produtos", label: "Produtos Gerais", component: <ProdutosTab {...context} /> },
        { value: "produtos_v2", label: "Cadastro de Produtos V2", component: <ProdutosV2Tab {...context} /> },
        { value: "categorias", label: "Categorias de Produtos", component: <CategoriasProdutosTab {...context} /> },
        { value: "unidades_medida", label: "Unidades de Medida", component: <UnidadesMedida {...context} /> },
        { value: "clientes", label: "Clientes", component: <ClientesTab {...context} /> },
        { value: "empresas", label: "Empresas", component: <EmpresasTab companies={context.companies} onCompanyUpdate={context.onDataUpdate} /> },
        { value: "usuarios", label: "Usuários", component: <UsuariosTab {...context} /> },
        { value: "permissoes", label: "Permissões de Usuários", component: <PermissoesTab {...context} /> },
        { value: "formas_pagamento", label: "Formas de Pagamento", component: <FormasPagamentoTab {...context} /> },
        { value: "operadoras_cartao", label: "Operadoras de Cartão", component: <OperadorasCartaoTab {...context} /> },
        { value: "maquinas_cartao", label: "Máquinas de Cartão", component: <MaquinasCartao {...context} /> },
        { value: "certificados", label: "Certificados Digitais", component: <CertificadosTab {...context} /> },
        { value: "dre_groups", label: "Grupos DRE", component: <DreGroupsTab {...context} /> },
        { value: "dre_mappings", label: "Mapeamentos DRE", component: <DreMappingsTab {...context} /> },
        { value: "modulos_sistema", label: "Módulos do Sistema", component: <ModulosSistema {...context} /> },
        { value: "locais_impressao", label: "Locais de Impressão", component: <LocaisImpressao {...context} /> },
      ];

      const renderActiveSubModule = () => {
        const module = subModules.find(m => m.value === activeSubModule);
        return module ? module.component : null;
      };

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {!activeSubModule ? (
            <Card className="p-4 rounded-xl shadow-md border">
              <CardHeader>
                <CardTitle className="text-2xl font-bold mb-4">Módulo de Cadastros</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {subModules.map(module => (
                  <Button
                    key={module.value}
                    onClick={() => setActiveSubModule(module.value)}
                    className="h-24 text-lg font-semibold flex items-center justify-center text-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300"
                  >
                    {module.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          ) : (
            <div>
              <Button variant="ghost" onClick={() => setActiveSubModule(null)} className="mb-4 flex items-center gap-2">
                <ChevronLeft className="w-5 h-5" /> Voltar para Cadastros
              </Button>
              {renderActiveSubModule()}
            </div>
          )}
        </motion.div>
      );
    };

    export default Cadastros;
