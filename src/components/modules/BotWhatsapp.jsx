import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IntegracaoWhatsApp from '@/components/modules/whatsapp/IntegracaoWhatsApp';
import VinculoWhatsApp from '@/components/modules/whatsapp/VinculoWhatsApp';
import MonitoramentoBot from '@/components/modules/whatsapp/MonitoramentoBot';
import { MessageSquare, Link2, Settings } from 'lucide-react';

const BotWhatsapp = (props) => {
  const [activeTab, setActiveTab] = useState("monitoramento");

  const tabs = [
    {
      value: "monitoramento",
      label: "Monitoramento",
      icon: MessageSquare,
      component: <MonitoramentoBot {...props} />
    },
    {
      value: "vinculos",
      label: "Vínculos",
      icon: Link2,
      component: <VinculoWhatsApp {...props} />
    },
    {
      value: "integracao",
      label: "Configuração",
      icon: Settings,
      component: <IntegracaoWhatsApp {...props} />
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            {tab.component}
          </TabsContent>
        ))}
      </Tabs>
    </motion.div>
  );
};

export default BotWhatsapp;