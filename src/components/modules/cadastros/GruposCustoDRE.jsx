import React from 'react';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

const GruposCustoDRE = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center h-full p-8 text-center bg-card rounded-xl shadow-lg border"
    >
      <Construction className="w-16 h-16 mb-4 text-primary" />
      <h1 className="text-2xl font-bold text-card-foreground mb-2">Módulo em Construção</h1>
      <p className="text-muted-foreground max-w-md">
        O módulo de "Grupos de Custo DRE" está sendo preparado e em breve estará disponível para organizar e detalhar suas análises financeiras.
      </p>
    </motion.div>
  );
};

export default GruposCustoDRE;